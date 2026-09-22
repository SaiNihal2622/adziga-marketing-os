// Adziga — /api/analytics/ltv
// Sprint 12b — true LTV from Revenue event log

import { authedRoute } from "@/server/api";
import { LtvService } from "@/server/services/ltv-service";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const days = Number(url.searchParams.get("days") ?? 365);
  const report = await LtvService.report(ctx.orgId, clientId, days);
  return report;
});
