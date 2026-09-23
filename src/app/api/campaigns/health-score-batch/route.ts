// Adziga — /api/campaigns/health-score-batch
// Sprint 16b — bulk recompute campaign health for every campaign in the
// org. Used by the "Recompute all" button on /app/campaigns.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { recomputeOrgCampaignHealth } from "@/server/services/campaign-health";

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  return recomputeOrgCampaignHealth(ctx.orgId);
});
