// Adziga — /api/analytics/conversion-lag
// Sprint 10b — lead → customer conversion lag percentiles

import { authedRoute } from "@/server/api";
import { ConversionLagService } from "@/server/services/conversion-lag-service";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const days = Number(url.searchParams.get("days") ?? 90);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const report = await ConversionLagService.report(ctx.orgId, days, clientId);
  return report;
});
