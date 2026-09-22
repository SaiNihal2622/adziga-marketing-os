// Adziga — /api/analytics/anomalies/campaigns
// Sprint 9b — campaign anomaly detection with auto-pause recommendation

import { authedRoute } from "@/server/api";
import { CampaignAnomalyService } from "@/server/services/campaign-anomaly-service";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const days = Number(url.searchParams.get("days") ?? 30);
  const recommendation = url.searchParams.get("recommendation"); // pause | watch | scale
  let result = await CampaignAnomalyService.detectForOrg(ctx.orgId, days);
  if (recommendation) {
    result = result.filter((a) => a.recommendAction === recommendation);
  }
  return { anomalies: result, count: result.length, days };
});
