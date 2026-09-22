// Adziga — /api/analytics/predict
// Sprint 7b — predict outcomes for a proposed marketing plan
//
// Body:
//   { clientId?, industry?, plan: { totalBudget?, channels: [{platform, totalBudget, days?}] } }

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { PredictiveOutcomeModel } from "@/server/services/predictive-service";

const Channel = z.object({
  platform: z.string().min(1).max(40),
  totalBudget: z.number().nonnegative(),
  days: z.number().int().min(1).max(365).optional(),
  audience: z.string().optional()
});

const Body = z.object({
  clientId: z.string().optional(),
  industry: z.string().optional(),
  plan: z.object({
    totalBudget: z.number().nonnegative().optional(),
    channels: z.array(Channel).min(1)
  })
});

export const POST = authedRoute<z.input<typeof Body>>(Body, async (ctx, body) => {
  const prediction = await PredictiveOutcomeModel.predict({
    orgId: ctx.orgId,
    clientId: body.clientId,
    industry: body.industry,
    plan: body.plan
  });
  return prediction;
});
