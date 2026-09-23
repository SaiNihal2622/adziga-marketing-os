// Adziga — /api/intelligence/strategy/[id]/materialize
// Sprint 18b — POST to materialize an approved StrategyRecommendation
// into Campaign rows. ADMIN/FOUNDER only.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { StrategyAutoApply } from "@/server/services/strategy-apply";

const body = z.object({}).optional();

export const POST = authedRoute<z.infer<typeof body>>(
  body,
  async (ctx, _data, params) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    return StrategyAutoApply.materialize(ctx.orgId, params.id, ctx.userId);
  }
);
