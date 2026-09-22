// Adziga — /api/analytics/roi/export
// Sprint 10c — CSV export of the ROI report.
//
// GET /api/analytics/roi/export?clientId=...&days=60&format=csv
// Returns a downloadable CSV with one row per channel.

import { authedRoute } from "@/server/api";
import { ROIService } from "@/server/services/roi-service";
import { toCsv } from "@/lib/csv";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const clientId = url.searchParams.get("clientId");
  const days = Number(url.searchParams.get("days") ?? 60);
  if (!clientId) return new Response(JSON.stringify({ error: "clientId required" }), { status: 422 });

  const report = await ROIService.clientRoiReport(ctx.orgId, clientId, days);

  const channelRows = report.byChannel.map((c) => ({
    platform: c.platform,
    leads: c.leads,
    qualified: c.qualified,
    customers: c.customers,
    revenue: c.revenue,
    spend: c.spend,
    cac: c.cac,
    roas: c.roas,
    qualifiedRate: c.qualifiedRate
  }));
  const csv = toCsv(channelRows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roi-${clientId}-${days}d.csv"`
    }
  });
});
