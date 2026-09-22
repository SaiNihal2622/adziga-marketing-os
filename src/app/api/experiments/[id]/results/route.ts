// Adziga — /api/experiments/[id]/results
// Just the Bayesian analysis — used by the live tail on the detail page.

import { authedRoute } from "@/server/api";
import { ExperimentService } from "@/server/services/experiment-service";

export const GET = authedRoute(null, async (ctx, _body, params) => {
  const id = params.id;
  const exp = await ctx.prisma.experiment.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true }
  });
  if (!exp) return { error: "not found" } as any;
  const analysis = await ExperimentService.analyze(ctx.prisma, id);
  return analysis;
});
