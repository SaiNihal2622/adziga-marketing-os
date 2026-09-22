// Adziga — /api/analytics/roi/org
// Sprint 7a — org-wide ROI dashboard

import { authedRoute } from "@/server/api";
import { ROIService } from "@/server/services/roi-service";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const days = Number(url.searchParams.get("days") ?? 60);
  const dashboard = await ROIService.orgWideDashboard(ctx.orgId, days);
  return dashboard;
});
