import { z } from "zod";
import { authedRoute } from "@/server/api";
import { createSubscription } from "@/server/billing/razorpay";

const schema = z.object({ plan: z.enum(["PRO", "ZIGA_PLUS"]) });

export const POST = authedRoute(schema, async (ctx, body) => {
  const r = await createSubscription(ctx.orgId, body.plan);
  return { subscriptionId: r.subscriptionId, shortUrl: r.shortUrl };
});