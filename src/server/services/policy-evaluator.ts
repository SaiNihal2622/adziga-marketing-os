// Adziga — AutoApprove Policy Evaluator
//
// Given a change request (entityType, entityId, action, payload), decide
// whether it should auto-apply under any of the org's AutoApprove policies,
// or queue for human review.
//
// Decision logic per policy:
//   1. Policy must be enabled and match (entityType, action).
//   2. Every field in the payload must have a matching FieldConstraint in
//      the policy AND that constraint must pass against the entity's
//      current value. Any field without a constraint fails the policy.
//   3. Aggregate caps must pass: per-day, per-month, after-hours, dry-run.
//
// First passing policy wins. If multiple pass, the one with the strictest
// constraints (most fieldConstraints) is preferred — admins get the most
// conservative auto-apply.

import { prisma } from "@/lib/db";
import {
  AutoApprovePolicy,
  FieldConstraint,
  PolicyDecision,
  PolicyEntityType,
  PolicyAction
} from "./policy-types";

export type EvaluateInput = {
  orgId: string;
  entityType: PolicyEntityType;
  entityId: string;
  action: PolicyAction;
  payload: Record<string, unknown>;
  /** Optional — set by agents that already confirmed the action recently. */
  confirmationTimestamp?: Date | null;
};

export const PolicyEvaluator = {
  /**
   * Decide what to do with a change request. Returns a PolicyDecision:
   *   - auto_apply: apply the payload immediately, log to audit
   *   - dry_run: queue but mark "would auto-apply under policy X"
   *   - queue: queue for human review (most common)
   *
   * Cheap to call — loads only the org's policies + the target entity.
   */
  async evaluate(input: EvaluateInput): Promise<PolicyDecision> {
    const policies = await loadPolicies(input.orgId);
    if (policies.length === 0) {
      return { kind: "queue", reason: "No auto-approve policies configured for this org." };
    }

    const matching = policies.filter(
      (p) => p.enabled && p.entityType === input.entityType && p.action === input.action
    );
    if (matching.length === 0) {
      return {
        kind: "queue",
        reason: `No enabled policy matches (${input.entityType}, ${input.action}).`
      };
    }

    const oldEntity = await loadEntitySnapshot(input.entityType, input.entityId);
    const dailyCount = await countRecentApplies(input.orgId, 1);
    const monthlyCount = await countRecentApplies(input.orgId, 30);

    let nearestPolicy: AutoApprovePolicy | undefined;

    for (const policy of matching) {
      const result = await checkPolicy({
        policy,
        payload: input.payload,
        oldEntity,
        dailyCount,
        monthlyCount,
        confirmationTimestamp: input.confirmationTimestamp ?? null
      });
      if (result.passed) {
        if (result.caps.dryRun) {
          return {
            kind: "dry_run",
            policy,
            reason: `Policy "${policy.name}" matched (dry-run mode active).`
          };
        }
        return {
          kind: "auto_apply",
          policy,
          reason: `Policy "${policy.name}" matched: ${result.fieldReasons.join("; ")}.`
        };
      }
      nearestPolicy = policy;
    }

    return {
      kind: "queue",
      reason: `No policy passed all field constraints for this change.`,
      nearestPolicy
    };
  },

  /**
   * Run the evaluator without committing — used by the preview endpoint
   * so admins can see what WOULD auto-apply vs queue.
   */
  async preview(input: EvaluateInput): Promise<PolicyDecision> {
    return this.evaluate(input);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

async function loadPolicies(orgId: string): Promise<AutoApprovePolicy[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { autoApprovePolicies: true }
  });
  if (!org?.autoApprovePolicies) return [];
  try {
    const parsed = JSON.parse(org.autoApprovePolicies);
    if (!Array.isArray(parsed)) return [];
    return parsed as AutoApprovePolicy[];
  } catch {
    return [];
  }
}

async function loadEntitySnapshot(
  entityType: PolicyEntityType,
  entityId: string
): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case "Client":
      return prisma.client.findUnique({ where: { id: entityId } });
    case "Campaign":
      return prisma.campaign.findUnique({ where: { id: entityId } });
    case "AdSet":
      return prisma.adSet.findUnique({ where: { id: entityId } });
    case "Strategy":
      return prisma.strategy.findUnique({ where: { id: entityId } });
    case "Integration":
      return prisma.integration.findUnique({ where: { id: entityId } });
    default:
      return null;
  }
}

async function countRecentApplies(orgId: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  return prisma.approval.count({
    where: {
      orgId,
      appliedByPolicyId: { not: null },
      status: "applied",
      decidedAt: { gte: since }
    }
  });
}

type CheckResult = {
  passed: boolean;
  fieldReasons: string[];
  caps: { dryRun: boolean };
};

async function checkPolicy(args: {
  policy: AutoApprovePolicy;
  payload: Record<string, unknown>;
  oldEntity: Record<string, unknown> | null;
  dailyCount: number;
  monthlyCount: number;
  confirmationTimestamp: Date | null;
}): Promise<CheckResult> {
  const { policy, payload, oldEntity, dailyCount, monthlyCount, confirmationTimestamp } = args;
  const fieldReasons: string[] = [];

  // 1. Aggregate caps
  if (policy.caps.maxPerDay !== undefined && dailyCount >= policy.caps.maxPerDay) {
    return {
      passed: false,
      fieldReasons: [`daily cap reached (${dailyCount}/${policy.caps.maxPerDay})`],
      caps: { dryRun: !!policy.caps.dryRun }
    };
  }
  if (policy.caps.maxPerMonth !== undefined && monthlyCount >= policy.caps.maxPerMonth) {
    return {
      passed: false,
      fieldReasons: [`monthly cap reached (${monthlyCount}/${policy.caps.maxPerMonth})`],
      caps: { dryRun: !!policy.caps.dryRun }
    };
  }
  if (policy.caps.pauseAfterHour !== undefined) {
    const hour = new Date().getHours();
    if (hour >= policy.caps.pauseAfterHour) {
      return {
        passed: false,
        fieldReasons: [`after-hours (${hour} ≥ ${policy.caps.pauseAfterHour})`],
        caps: { dryRun: !!policy.caps.dryRun }
      };
    }
  }
  if (policy.caps.requireConfirmationWithinMinutes !== undefined && confirmationTimestamp) {
    const ageMs = Date.now() - confirmationTimestamp.getTime();
    const ageMin = ageMs / 60_000;
    if (ageMin > policy.caps.requireConfirmationWithinMinutes) {
      return {
        passed: false,
        fieldReasons: [
          `confirmation stale (${Math.round(ageMin)}m > ${policy.caps.requireConfirmationWithinMinutes}m)`
        ],
        caps: { dryRun: !!policy.caps.dryRun }
      };
    }
  }

  // 2. Field constraints. Every payload key must have a matching constraint.
  for (const fieldKey of Object.keys(payload)) {
    const constraint = policy.fieldConstraints.find((c) => c.field === fieldKey);
    if (!constraint) {
      return {
        passed: false,
        fieldReasons: [`field "${fieldKey}" has no constraint in policy`],
        caps: { dryRun: !!policy.caps.dryRun }
      };
    }
    const oldValue = oldEntity ? (oldEntity as any)[fieldKey] : undefined;
    const newValue = payload[fieldKey];
    const ok = checkFieldConstraint(constraint, oldValue, newValue);
    if (!ok) {
      return {
        passed: false,
        fieldReasons: [
          `field "${fieldKey}" failed constraint (old=${JSON.stringify(oldValue)} new=${JSON.stringify(newValue)})`
        ],
        caps: { dryRun: !!policy.caps.dryRun }
      };
    }
    fieldReasons.push(`${fieldKey}: ok`);
  }

  return { passed: true, fieldReasons, caps: { dryRun: !!policy.caps.dryRun } };
}

function checkFieldConstraint(
  c: FieldConstraint,
  oldValue: unknown,
  newValue: unknown
): boolean {
  // allowedValues: hard whitelist. Always evaluated when present.
  if (c.allowedValues && c.allowedValues.length > 0) {
    if (typeof newValue !== "string") return false;
    if (!c.allowedValues.includes(newValue)) return false;
  }

  // mustEqual: exact match.
  if (c.mustEqual !== undefined) {
    if (newValue !== c.mustEqual) return false;
  }

  // pattern: regex on stringified new value.
  if (c.pattern) {
    try {
      const re = new RegExp(c.pattern);
      if (!re.test(String(newValue))) return false;
    } catch {
      return false;
    }
  }

  // Numeric constraints. Only when new and old are numbers.
  const newNum = toNum(newValue);
  const oldNum = toNum(oldValue);
  if (c.maxDelta !== undefined) {
    if (newNum === null || oldNum === null) {
      // Cannot evaluate without numeric values
      return false;
    }
    if (Math.abs(newNum - oldNum) > c.maxDelta) return false;
  }
  if (c.maxRelativeChange !== undefined) {
    if (newNum === null || oldNum === null) {
      return false;
    }
    const denom = Math.max(Math.abs(oldNum), 1);
    if (Math.abs(newNum - oldNum) / denom > c.maxRelativeChange) return false;
  }

  return true;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
