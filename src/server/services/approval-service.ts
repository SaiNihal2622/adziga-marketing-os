// Adziga — Approval Service
// Governs changes that require Adziga admin sign-off before applying.
//
// Architectural intent: clients can stage any change freely (their UI shows
// "Pending approval" instead of the new value). Adziga admins review the
// queue in /app/admin/approvals and apply or reject. The same queue is used
// for high-severity changes from autonomous agents — nothing bypasses review.
//
// Severity model:
//   "critical"  — ALWAYS requires approval (budgets, tiers, credentials, deletions)
//   "important" — requires approval unless a matching org AutoApprove policy
//                 permits auto-apply within its field constraints + caps
//   "minor"     — auto-applies, recorded in audit only
//
// Every approval records who asked (user | agent | client_user), the action,
// the proposed payload, the severity, and a human title for the queue UI.
// Auto-applies additionally record appliedByPolicyId so the audit trail
// shows which policy authorised the change.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { PolicyEvaluator } from "./policy-evaluator";
import { AutoApprovePolicy, PolicyEntityType, PolicyAction } from "./policy-types";

export type { AutoApprovePolicy, PolicyEntityType, PolicyAction, FieldConstraint, PolicyCaps } from "./policy-types";

export type ApprovalSeverity = "critical" | "important" | "minor";
export type ApprovalAction = "update" | "delete" | "launch" | "pause" | "archive" | "create";
export type ApprovalRequesterKind = "user" | "agent" | "client_user";

export type RequestApprovalInput = {
  orgId: string;
  entityType: string;
  entityId: string;
  action: ApprovalAction;
  title: string;
  payload?: Record<string, unknown> | null;
  requestedById: string;
  requestedByKind: ApprovalRequesterKind;
  severity: ApprovalSeverity;
  reason?: string | null;
};

export type ApprovalListFilter = {
  orgId: string;
  status?: "pending" | "approved" | "rejected" | "applied" | "cancelled";
  entityType?: string;
  severity?: ApprovalSeverity;
  limit?: number;
};

export type ApprovalRow = {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  payload: Record<string, unknown> | null;
  requestedById: string;
  requestedByKind: string;
  severity: string;
  reason: string | null;
  approverId: string | null;
  status: string;
  notes: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  approver: { id: string; name: string | null; email: string } | null;
};

export type DecideApprovalInput = {
  orgId: string;
  approvalId: string;
  approverId: string;
  decision: "approved" | "rejected";
  notes?: string | null;
};

export const ApprovalService = {
  /**
   * Decide whether a particular change requires admin approval.
   * Entity-type-aware: returns "minor" if the change is safe, "important"
   * for things clients usually touch, "critical" for things that always
   * need a human.
   */
  classify(entityType: string, payload: Record<string, unknown> | null | undefined): ApprovalSeverity {
    if (!payload) return "important";

    // Always-critical fields, no matter which entity.
    const alwaysCritical = [
      "monthlyBudget",
      "tier",
      "credentials",
      "accessToken",
      "secret",
      "password",
      "role",
      "permissions"
    ];
    for (const key of alwaysCritical) {
      if (key in payload) return "critical";
    }

    // Entity-specific rules.
    if (entityType === "Client") {
      if ("creativePreference" in payload) return "important";
      if ("status" in payload && payload.status === "CHURNED") return "critical";
    }
    if (entityType === "Campaign") {
      if ("status" in payload) return "important";
      if ("budget" in payload) return "critical";
    }
    if (entityType === "AdSet") {
      if ("budget" in payload || "status" in payload) return "important";
    }
    if (entityType === "Integration") {
      // Any change to integration config is critical.
      return "critical";
    }
    if (entityType === "Strategy") {
      if ("status" in payload) return "important";
    }

    // Default: minor — log only, no approval.
    return "minor";
  },

  /**
   * Stage a change request. If the severity is "minor", it is auto-applied
   * immediately and recorded in the audit log instead of being queued.
   *
   * For "important" severity, the request runs through the org's
   * AutoApprove policies. If a matching policy says auto-apply AND every
   * field constraint + cap passes, the change applies immediately with
   * appliedByPolicyId recorded. Otherwise it queues for human review.
   *
   * "critical" severity NEVER auto-applies — always queues.
   */
  async request(input: RequestApprovalInput) {
    const severity = input.severity || this.classify(input.entityType, input.payload ?? null);
    const payload = input.payload ?? {};

    // 1. Minor severity: always auto-applies, no policy needed.
    if (severity === "minor") {
      const applied = await this.applyPayload(input.entityType, input.entityId, payload, input.action);
      const approval = await prisma.approval.create({
        data: {
          orgId: input.orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          title: input.title,
          payload: JSON.stringify(payload),
          requestedById: input.requestedById,
          requestedByKind: input.requestedByKind,
          severity,
          reason: input.reason ?? null,
          status: "applied",
          approverId: input.requestedById,
          decidedAt: new Date(),
          appliedByPolicyId: "MINOR_AUTO"
        }
      });
      await audit(input.orgId, input.requestedById, `auto_apply.${input.entityType.toLowerCase()}.${input.action}`, {
        entityType: input.entityType,
        entityId: input.entityId,
        after: payload
      });
      return { autoApplied: true as const, result: applied, severity, approval };
    }

    // 2. Critical severity: NEVER auto-applies.
    if (severity === "critical") {
      const approval = await prisma.approval.create({
        data: {
          orgId: input.orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          title: input.title,
          payload: JSON.stringify(payload),
          requestedById: input.requestedById,
          requestedByKind: input.requestedByKind,
          severity,
          reason: input.reason ?? null,
          status: "pending"
        }
      });
      return { autoApplied: false as const, approval, severity, policy: null };
    }

    // 3. Important severity: run policy evaluator.
    const decision = await PolicyEvaluator.evaluate({
      orgId: input.orgId,
      entityType: input.entityType as PolicyEntityType,
      entityId: input.entityId,
      action: input.action as PolicyAction,
      payload,
      confirmationTimestamp: (input as any).confirmationTimestamp ?? null
    });

    if (decision.kind === "auto_apply") {
      const applied = await this.applyPayload(input.entityType, input.entityId, payload, input.action);
      const approval = await prisma.approval.create({
        data: {
          orgId: input.orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          title: input.title,
          payload: JSON.stringify(payload),
          requestedById: input.requestedById,
          requestedByKind: input.requestedByKind,
          severity,
          reason: input.reason ?? null,
          status: "applied",
          approverId: input.requestedById,
          decidedAt: new Date(),
          appliedByPolicyId: decision.policy.id
        }
      });
      await audit(
        input.orgId,
        input.requestedById,
        `auto_apply_policy.${input.entityType.toLowerCase()}.${input.action}`,
        {
          entityType: input.entityType,
          entityId: input.entityId,
          after: {
            payload,
            policyId: decision.policy.id,
            policyName: decision.policy.name,
            reason: decision.reason
          }
        }
      );
      return {
        autoApplied: true as const,
        result: applied,
        severity,
        approval,
        policy: decision.policy,
        reason: decision.reason
      };
    }

    // 4. Otherwise: queue for human review. For dry-run, surface in the
    //    approval row's reason so admins see "would auto-apply under X".
    const reasonWithPolicy =
      decision.kind === "dry_run"
        ? `[Would auto-apply under "${decision.policy.name}" if dry-run mode were off] ${input.reason ?? ""}`.trim()
        : input.reason ?? null;

    const approval = await prisma.approval.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        title: input.title,
        payload: JSON.stringify(payload),
        requestedById: input.requestedById,
        requestedByKind: input.requestedByKind,
        severity,
        reason: reasonWithPolicy,
        status: "pending"
      }
    });
    return {
      autoApplied: false as const,
      approval,
      severity,
      policy: decision.kind === "dry_run" ? decision.policy : null,
      reason: decision.reason
    };
  },

  async list(filter: ApprovalListFilter): Promise<{ items: ApprovalRow[]; counts: { pending: number; approved: number; rejected: number; applied: number; cancelled: number } }> {
    const where = {
      orgId: filter.orgId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.severity ? { severity: filter.severity } : {})
    };

    const [items, pending, approved, rejected, applied, cancelled] = await Promise.all([
      prisma.approval.findMany({
        where,
        orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
        take: filter.limit ?? 100,
        include: { approver: { select: { id: true, name: true, email: true } } }
      }),
      prisma.approval.count({ where: { orgId: filter.orgId, status: "pending" } }),
      prisma.approval.count({ where: { orgId: filter.orgId, status: "approved" } }),
      prisma.approval.count({ where: { orgId: filter.orgId, status: "rejected" } }),
      prisma.approval.count({ where: { orgId: filter.orgId, status: "applied" } }),
      prisma.approval.count({ where: { orgId: filter.orgId, status: "cancelled" } })
    ]);

    return {
      items: items.map((a): ApprovalRow => ({
        id: a.id,
        orgId: a.orgId,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        title: a.title,
        payload: a.payload ? safeParse(a.payload) : null,
        requestedById: a.requestedById,
        requestedByKind: a.requestedByKind,
        severity: a.severity,
        reason: a.reason,
        approverId: a.approverId,
        status: a.status,
        notes: a.notes,
        requestedAt: a.requestedAt,
        decidedAt: a.decidedAt,
        approver: a.approver
      })),
      counts: { pending, approved, rejected, applied, cancelled }
    };
  },

  async get(orgId: string, id: string): Promise<ApprovalRow> {
    const a = await prisma.approval.findFirst({
      where: { id, orgId },
      include: { approver: { select: { id: true, name: true, email: true } } }
    });
    if (!a) throw new NotFoundError("Approval", id);
    return {
      id: a.id,
      orgId: a.orgId,
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      title: a.title,
      payload: a.payload ? safeParse(a.payload) : null,
      requestedById: a.requestedById,
      requestedByKind: a.requestedByKind,
      severity: a.severity,
      reason: a.reason,
      approverId: a.approverId,
      status: a.status,
      notes: a.notes,
      requestedAt: a.requestedAt,
      decidedAt: a.decidedAt,
      approver: a.approver
    };
  },

  async decide(input: DecideApprovalInput) {
    const a = await prisma.approval.findFirst({ where: { id: input.approvalId, orgId: input.orgId } });
    if (!a) throw new NotFoundError("Approval", input.approvalId);
    if (a.status !== "pending") throw new ValidationError(`Approval already ${a.status}`);

    if (input.decision === "rejected") {
      const updated = await prisma.approval.update({
        where: { id: a.id },
        data: {
          status: "rejected",
          approverId: input.approverId,
          decidedAt: new Date(),
          notes: input.notes ?? null
        }
      });
      await audit(input.orgId, input.approverId, "approval.rejected", {
        entityType: a.entityType,
        entityId: a.entityId,
        after: { approvalId: a.id, notes: input.notes ?? null }
      });
      return updated;
    }

    // Approved — apply the payload atomically.
    const payload = a.payload ? safeParse(a.payload) : {};
    const applied = await this.applyPayload(a.entityType, a.entityId, payload ?? {}, a.action as ApprovalAction);

    const updated = await prisma.approval.update({
      where: { id: a.id },
      data: {
        status: "applied",
        approverId: input.approverId,
        decidedAt: new Date(),
        notes: input.notes ?? null
      }
    });
    await audit(input.orgId, input.approverId, "approval.applied", {
      entityType: a.entityType,
      entityId: a.entityId,
      after: { approvalId: a.id, applied: applied ?? null, notes: input.notes ?? null }
    });
    return updated;
  },

  // ─────────────────────────────────────────────────────────────────────
  // AutoApprove policy management (org-level)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Read all AutoApprove policies for an org. Returns [] when none set.
   */
  async listPolicies(orgId: string): Promise<AutoApprovePolicy[]> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { autoApprovePolicies: true }
    });
    if (!org?.autoApprovePolicies) return [];
    try {
      const parsed = JSON.parse(org.autoApprovePolicies);
      return Array.isArray(parsed) ? (parsed as AutoApprovePolicy[]) : [];
    } catch {
      return [];
    }
  },

  /**
   * Replace the org's policy list atomically.
   */
  async setPolicies(orgId: string, policies: AutoApprovePolicy[], updatedById: string) {
    // Basic validation: enforce that no policy targets "critical" fields.
    const criticalFields = new Set([
      "monthlyBudget",
      "tier",
      "credentials",
      "accessToken",
      "secret",
      "password",
      "role",
      "permissions"
    ]);
    for (const p of policies) {
      for (const fc of p.fieldConstraints) {
        if (criticalFields.has(fc.field)) {
          throw new ValidationError(
            `Policy "${p.name}" targets critical field "${fc.field}". Critical fields cannot be auto-applied — they always require human review.`
          );
        }
      }
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: { autoApprovePolicies: JSON.stringify(policies) }
    });
    await audit(orgId, updatedById, "policy.set", {
      after: { count: policies.length }
    });
    return policies;
  },

  /**
   * Add or update one policy by id. Generates a fresh id if new.
   */
  async upsertPolicy(orgId: string, policy: AutoApprovePolicy, updatedById: string) {
    const existing = await this.listPolicies(orgId);
    const idx = existing.findIndex((p) => p.id === policy.id);
    const now = new Date().toISOString();
    const next: AutoApprovePolicy = {
      ...policy,
      createdAt: idx >= 0 ? existing[idx].createdAt : now,
      updatedAt: now,
      createdById: idx >= 0 ? existing[idx].createdById : updatedById
    };
    if (idx >= 0) existing[idx] = next;
    else existing.push(next);
    return this.setPolicies(orgId, existing, updatedById).then(() => next);
  },

  /**
   * Remove a policy by id.
   */
  async deletePolicy(orgId: string, policyId: string, deletedById: string) {
    const existing = await this.listPolicies(orgId);
    const next = existing.filter((p) => p.id !== policyId);
    if (next.length === existing.length) {
      throw new NotFoundError("AutoApprovePolicy", policyId);
    }
    await this.setPolicies(orgId, next, deletedById);
    return { deleted: policyId, remaining: next.length };
  },

  /**
   * List recent auto-applies (both minor and policy-driven) for the audit feed.
   */
  async recentAutoApplies(orgId: string, limit = 50) {
    return prisma.approval.findMany({
      where: {
        orgId,
        status: "applied",
        appliedByPolicyId: { not: null }
      },
      orderBy: { decidedAt: "desc" },
      take: limit,
      include: { approver: { select: { id: true, name: true, email: true } } }
    });
  },

  async cancel(orgId: string, approvalId: string, by: string) {
    const a = await prisma.approval.findFirst({ where: { id: approvalId, orgId } });
    if (!a) throw new NotFoundError("Approval", approvalId);
    if (a.status !== "pending") throw new ValidationError(`Approval already ${a.status}`);
    const updated = await prisma.approval.update({
      where: { id: a.id },
      data: { status: "cancelled", decidedAt: new Date() }
    });
    await audit(orgId, by, "approval.cancelled", {
      entityType: a.entityType,
      entityId: a.entityId,
      after: { approvalId: a.id }
    });
    return updated;
  },

  /**
   * Internal — applies the recorded payload to the underlying entity.
   * Currently supports Client, Campaign, AdSet, Strategy, Integration.
   * Extend by adding a case here when new entities gain approval-gated fields.
   */
  async applyPayload(entityType: string, entityId: string, payload: Record<string, unknown>, action: ApprovalAction) {
    if (action === "delete") {
      switch (entityType) {
        case "Client":
          return prisma.client.update({ where: { id: entityId }, data: { status: "CHURNED" } });
        case "Campaign":
          return prisma.campaign.update({ where: { id: entityId }, data: { status: "ARCHIVED" } });
        default:
          throw new ValidationError(`Delete not supported for ${entityType}`);
      }
    }

    switch (entityType) {
      case "Client":
        return prisma.client.update({ where: { id: entityId }, data: payload as any });
      case "Campaign":
        return prisma.campaign.update({ where: { id: entityId }, data: payload as any });
      case "AdSet":
        return prisma.adSet.update({ where: { id: entityId }, data: payload as any });
      case "Strategy":
        return prisma.strategy.update({ where: { id: entityId }, data: payload as any });
      case "Integration":
        return prisma.integration.update({ where: { id: entityId }, data: payload as any });
      default:
        throw new ValidationError(`Unknown entityType for approval apply: ${entityType}`);
    }
  }
};

function safeParse(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
