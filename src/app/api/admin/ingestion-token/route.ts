// Adziga — /api/admin/ingestion-token
// Mint a new org-scoped ingestion token for the ad-spend webhook.
// Existing tokens are replaced.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { AdSpendIngestionService } from "@/server/services/ad-spend-ingestion";

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const token = await AdSpendIngestionService.mintIngestionToken(ctx.orgId);
  return { token };
});
