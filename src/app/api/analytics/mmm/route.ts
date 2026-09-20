import { z } from "zod";
import { authedRoute } from "@/server/api";
import { runMMMForOrg } from "@/lib/analytics";

const schema = z.object({
  days: z.number().int().min(14).max(365).optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  const result = await runMMMForOrg(ctx.orgId, body.days ?? 90);
  return result;
});
