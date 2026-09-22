// Adziga — /api/campaigns (list)
import { authedRoute } from "@/server/api";
import { CampaignService } from "@/server/services/campaign-service";

export const GET = authedRoute(
  null,
  async (ctx) => {
    return CampaignService.list(ctx.orgId, {
      clientId: ctx.req.nextUrl.searchParams.get("clientId") ?? undefined,
      status: ctx.req.nextUrl.searchParams.get("status") ?? undefined
    });
  }
);
