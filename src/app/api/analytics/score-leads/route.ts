import { z } from "zod";
import { authedRoute } from "@/server/api";
import { scoreAllLeadsForOrg } from "@/lib/analytics";

const schema = z.object({
  limit: z.number().int().min(1).max(500).optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  const results = await scoreAllLeadsForOrg(ctx.orgId, body.limit ?? 100);
  return { count: results.length, scores: results };
});
