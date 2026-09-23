// Adziga — /api/campaigns/[id]/health-score
// Sprint 16b — recompute and return the composite health score for one
// campaign. Persists the tier to Campaign.health so the existing badge
// on /app/campaigns lights up.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { recomputeCampaignHealth } from "@/server/services/campaign-health";

export const POST = authedRoute(null, async (ctx, _data, params) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const result = await recomputeCampaignHealth(params.id);
  if (!result) return { error: "Campaign not found" } as any;
  return { result };
});
