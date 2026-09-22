// Adziga — /api/experiments/[id]/promote
// Sprint 9c — promote experiment winner config into a StrategyRecommendation.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ExperimentService } from "@/server/services/experiment-service";

const schema = z.object({
  channels: z.array(z.string()).optional()
});

export const POST = authedRoute<z.input<typeof schema>>(schema, async (ctx, body, params) => {
  const promo = await ExperimentService.promoteWinner(ctx.prisma, params.id, {
    createdById: ctx.userId,
    channels: body.channels
  });
  if (!promo) {
    return { error: "experiment has no winner yet" } as any;
  }
  return { promotion: promo };
});
