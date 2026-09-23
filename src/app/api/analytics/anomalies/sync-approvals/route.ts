// Adziga — /api/analytics/anomalies/sync-approvals
// Sprint 16a — manually trigger AnomalyApprovalService.sync.
// Admins can hit this to populate /app/admin/approvals with all the
// pause/scale candidates from the latest anomaly scan.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { AnomalyApprovalService } from "@/server/services/anomaly-approval";

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const result = await AnomalyApprovalService.sync(ctx.orgId);
  return result;
});
