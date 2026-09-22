// Adziga — /api/analytics/ltv/record
// POST a new revenue event. Idempotent on externalRef.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { LtvService } from "@/server/services/ltv-service";

const Body = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  kind: z.enum(["product", "subscription", "upsell", "referral", "other"]).optional(),
  externalRef: z.string().optional(),
  source: z.string().optional(),
  clientId: z.string().optional(),
  campaignId: z.string().optional()
});

export const POST = authedRoute<z.input<typeof Body>>(Body, async (ctx, body) => {
  const result = await LtvService.recordRevenue({
    orgId: ctx.orgId,
    customerId: body.customerId,
    amount: body.amount,
    kind: body.kind,
    externalRef: body.externalRef,
    source: body.source,
    clientId: body.clientId,
    campaignId: body.campaignId
  });
  return result;
});
