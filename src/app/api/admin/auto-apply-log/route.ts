// Adziga — /api/admin/auto-apply-log
// Recent auto-applies (both minor and policy-driven). Surfaces the audit feed
// for the AutoApprove admin UI.

import { authedRoute } from "@/server/api";
import { ApprovalService } from "@/server/services/approval-service";

export const GET = authedRoute<{ limit?: string }>(null, async (ctx) => {
  const limit = ctx.req.nextUrl.searchParams.get("limit");
  const items = await ApprovalService.recentAutoApplies(
    ctx.orgId,
    limit ? Math.min(200, Math.max(1, Number(limit))) : 50
  );
  return {
    items: items.map((a) => ({
      id: a.id,
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      title: a.title,
      severity: a.severity,
      appliedByPolicyId: a.appliedByPolicyId,
      approver: a.approver,
      decidedAt: a.decidedAt,
      requestedById: a.requestedById,
      requestedByKind: a.requestedByKind,
      payload: a.payload ? safeParse(a.payload) : null
    }))
  };
});

function safeParse(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
