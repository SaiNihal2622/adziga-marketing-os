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
//   "important" — requires approval unless delegated to the client
//   "minor"     — auto-applies, recorded in audit only
//
// Every approval records who asked (user | agent | client_user), the action,
// the proposed payload, the severity, and a human title for the queue UI.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

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
   */
  async request(input: RequestApprovalInput) {
    const severity = input.severity || this.classify(input.entityType, input.payload ?? null);

    // Auto-apply minor changes immediately.
    if (severity === "minor") {
      const applied = await this.applyPayload(input.entityType, input.entityId, input.payload ?? {}, input.action);
      await audit(input.orgId, input.requestedById, `auto_apply.${input.entityType.toLowerCase()}.${input.action}`, {
        entityType: input.entityType,
        entityId: input.entityId,
        after: input.payload ?? {}
      });
      return { autoApplied: true as const, result: applied, severity };
    }

    const approval = await prisma.approval.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        title: input.title,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        requestedById: input.requestedById,
        requestedByKind: input.requestedByKind,
        severity,
        reason: input.reason ?? null,
        status: "pending"
      }
    });

    return { autoApplied: false as const, approval, severity };
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
