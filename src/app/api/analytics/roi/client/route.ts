// Adziga — /api/analytics/roi/client
// Sprint 7a — per-client ROI deep dive

import { authedRoute } from "@/server/api";
import { ROIService } from "@/server/services/roi-service";

export const GET = authedRoute(null, async (ctx, body) => {
  const url = new URL(ctx.req.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  if (!clientId) return { error: "clientId required" } as any;
  const days = Number(url.searchParams.get("days") ?? 60);
  const report = await ROIService.clientRoiReport(ctx.orgId, clientId, days);
  return report;
});
