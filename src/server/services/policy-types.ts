// Adziga — AutoApprove Policy types
//
// An AutoApprove policy says "if a change request matches (entityType, action)
// AND every payload field satisfies its constraint AND aggregate caps allow,
// apply it automatically instead of queuing for human review."
//
// Conservative default: every org starts with an empty policies list, so the
// behaviour is identical to before — everything queues. Admins opt in by
// adding policies at /app/admin/auto-approve.
//
// Why this is safe:
//   - The classifier already maps "critical" fields (budgets, credentials,
//     tiers) to always-require-approval. Policies can ONLY relax
//     "important"/"minor" severity to auto-apply — never "critical".
//   - Every auto-apply is still recorded (Approval row with status=applied
//     and appliedByPolicyId set) so the audit trail is complete.
//   - Caps prevent runaway auto-application (per-day, per-month, after-hours
//     queueing, requires-dry-run mode).

export type PolicyEntityType = "Client" | "Campaign" | "AdSet" | "Strategy" | "Integration";
export type PolicyAction = "update" | "delete" | "launch" | "pause" | "archive" | "create";

/**
 * One constraint on one field of the payload. The new value (from the change
 * request) and the current value (from the entity) must both be present.
 *
 * At least one of maxDelta / maxRelativeChange / allowedValues / isTrue /
 * allowedStringPattern must be set. The evaluator combines them with AND.
 */
export type FieldConstraint = {
  /** Field name on the payload, e.g. "monthlyBudget". */
  field: string;

  /**
   * Maximum absolute change allowed: |new - old| <= maxDelta.
   * Use this for absolute quantities (rupees, impressions, daily caps).
   */
  maxDelta?: number;

  /**
   * Maximum relative change allowed: |new - old| / max(|old|, 1) <= maxRelativeChange.
   * 0.10 = max 10% change. Use this for rates, percentages, scores.
   */
  maxRelativeChange?: number;

  /**
   * Whitelist of allowed new values. Use this for status-like fields.
   * e.g. ["ACTIVE", "PAUSED"] means auto-apply is only allowed when the
   * proposed status is one of these.
   */
  allowedValues?: string[];

  /**
   * If true, the field must equal true. Used for boolean toggles like
   * autoOptimize, paused, etc. Pair with allowedValues for clarity.
   */
  mustEqual?: boolean | string | number;

  /**
   * Regex pattern the new value (stringified) must match. Optional.
   */
  pattern?: string;
};

/**
 * Aggregate caps on a policy. Any violation falls through to the next
 * matching policy, or queues for human review if none remain.
 */
export type PolicyCaps = {
  /** Max auto-applies per org per 24h under this policy. */
  maxPerDay?: number;

  /** Max auto-applies per org per 30d under this policy. */
  maxPerMonth?: number;

  /**
   * If true, the policy still records what WOULD auto-apply but queues it
   * for human review anyway. Useful for "shadow mode" — see the impact
   * before turning it on.
   */
  dryRun?: boolean;

  /**
   * If set, after this 24h clock time (server-local), the policy queues
   * instead of auto-applying. e.g. "18" means auto-apply until 18:00,
   * queue after. Empty string = no after-hours limit.
   */
  pauseAfterHour?: number;

  /**
   * Require explicit confirmation token from the requester. Used for
   * agent-initiated changes that should be auto-applied only when the
   * agent has recently confirmed the action is still desired.
   */
  requireConfirmationWithinMinutes?: number;
};

/**
 * One AutoApprove policy. Stored as a JSON-encoded array on
 * Organization.autoApprovePolicies.
 */
export type AutoApprovePolicy = {
  /** Stable id, generated on create. */
  id: string;

  /** Display name. e.g. "Pause underperforming campaigns". */
  name: string;

  /** Optional longer description. */
  description?: string;

  /** What entity this policy targets. */
  entityType: PolicyEntityType;

  /** What action this policy targets. */
  action: PolicyAction;

  /** Per-field constraints. ALL must pass for auto-apply. */
  fieldConstraints: FieldConstraint[];

  /** Aggregate caps. ALL must pass for auto-apply. */
  caps: PolicyCaps;

  /** Whether the policy is currently active. Inactive = skipped. */
  enabled: boolean;

  /** Audit. */
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

/**
 * Decision returned by the evaluator. The caller decides what to do.
 */
export type PolicyDecision =
  | {
      kind: "auto_apply";
      policy: AutoApprovePolicy;
      reason: string;
    }
  | {
      kind: "dry_run";
      policy: AutoApprovePolicy;
      reason: string;
    }
  | {
      kind: "queue";
      reason: string;
      /** Policy that almost matched (if any) — used in the UI for hints. */
      nearestPolicy?: AutoApprovePolicy;
    };

/**
 * Lightweight constraint helpers used by tests + the preview endpoint.
 */
export function describeConstraint(c: FieldConstraint): string {
  const parts: string[] = [`field=${c.field}`];
  if (c.maxDelta !== undefined) parts.push(`|Δ|≤${c.maxDelta}`);
  if (c.maxRelativeChange !== undefined) parts.push(`Δ≤${(c.maxRelativeChange * 100).toFixed(0)}%`);
  if (c.allowedValues?.length) parts.push(`∈{${c.allowedValues.join(",")}}`);
  if (c.mustEqual !== undefined) {
    const eq = c.mustEqual as unknown;
    if (typeof eq === "string") parts.push(`="${eq}"`);
    else parts.push(`=${JSON.stringify(eq)}`);
  }
  if (c.pattern) parts.push(`/ ${c.pattern} /`);
  return parts.join(" ");
}

export function describePolicy(p: AutoApprovePolicy): string {
  const cs = p.fieldConstraints.map(describeConstraint).join(" & ");
  const caps = Object.entries(p.caps)
    .filter(([, v]) => v !== undefined && v !== false && v !== 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return `[${p.entityType}.${p.action}] ${cs}${caps ? ` (caps: ${caps})` : ""}`;
}
