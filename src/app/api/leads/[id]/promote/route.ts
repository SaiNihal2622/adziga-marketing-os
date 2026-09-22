// Adziga — /api/leads/[id]/promote
// Atomic lead → customer promotion. The endpoint that closes the loop:
// Lead → Qualified → Customer → Revenue, with attribution preserved.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { AttributionService } from "@/server/services/attribution-service";

const schema = z.object({
  revenue: z.number().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
  acquiredCampaignId: z.string().min(1).optional().nullable()
});

export const POST = authedRoute<z.infer<typeof schema>>(
  schema,
  async (ctx, data, params) => {
    const result = await AttributionService.promoteLeadToCustomer({
      orgId: ctx.orgId,
      userId: ctx.userId,
      leadId: params.id,
      revenue: data.revenue,
      notes: data.notes ?? undefined,
      acquiredCampaignId: data.acquiredCampaignId ?? undefined
    });
    return result;
  }
);
