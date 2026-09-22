// Adziga — /api/analytics/funnel
// Per-campaign or per-org funnel + value-adjusted CPL rollups.
// Powers the Marketing Command Center page and the campaign detail dashboards.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { AttributionService } from "@/server/services/attribution-service";

const querySchema = z.object({
  campaignId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  view: z.enum(["campaign", "org", "leaderboard"]).optional()
});

export const GET = authedRoute<z.infer<typeof querySchema>>(
  null,
  async (ctx, _data) => {
    const url = ctx.req.nextUrl;
    const campaignId = url.searchParams.get("campaignId");
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Math.max(1, Math.min(365, Number(daysRaw))) : 90;
    const view = url.searchParams.get("view") ?? "org";
    const since = new Date(Date.now() - days * 86_400_000);

    if (view === "campaign" && campaignId) {
      return AttributionService.campaignFunnel(ctx.orgId, campaignId);
    }
    if (view === "leaderboard") {
      return AttributionService.valueAdjustedCpl(ctx.orgId, { since, clientId });
    }
    return AttributionService.orgFunnel(ctx.orgId, { since });
  }
);
