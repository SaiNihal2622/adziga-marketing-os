// Adziga — /api/admin/ingestion-token/revoke
// Sprint 19c — explicitly revoke the current org's ingestion token.
// Useful when you've leaked it and want to invalidate it before
// rotating to a fresh one.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { AdSpendIngestionService } from "@/server/services/ad-spend-ingestion";

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const removed = await AdSpendIngestionService.revokeIngestionToken(ctx.orgId);
  return { removed };
});
