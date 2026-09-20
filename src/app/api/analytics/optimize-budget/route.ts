import { z } from "zod";
import { authedRoute } from "@/server/api";
import { optimizeBudgetForOrg } from "@/lib/analytics";

const schema = z.object({
  totalBudget: z.number().min(0),
  days: z.number().int().min(7).max(180).optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  const result = await optimizeBudgetForOrg(ctx.orgId, body.totalBudget, body.days ?? 30);
  return result;
});
