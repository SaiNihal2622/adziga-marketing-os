// Adziga — /api/analytics/funnel-snapshot
// Org / client / campaign funnel snapshot with drop-off detection.
// Powers /app/analytics and the Command Center funnel view.

import { authedRoute } from "@/server/api";
import { FunnelService } from "@/server/services/funnel-service";

export const GET = authedRoute(
  null,
  async (ctx) => {
    const url = ctx.req.nextUrl;
    const view = url.searchParams.get("view") ?? "snapshot";
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Math.max(7, Math.min(365, Number(daysRaw))) : 90;

    if (view === "diff") {
      return FunnelService.diff({ orgId: ctx.orgId, clientId, campaignId, windowDays: days });
    }
    return FunnelService.snapshot({ orgId: ctx.orgId, clientId, campaignId, windowDays: days });
  }
);
