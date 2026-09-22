// Adziga — /api/campaigns/[id]
// GET single campaign; PATCH proposes an update through approval workflow.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { CampaignService } from "@/server/services/campaign-service";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  platform: z.enum(["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"]).optional(),
  objective: z.string().max(200).optional(),
  budget: z.number().nonnegative().nullable().optional(),
  spent: z.number().nonnegative().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "INTERNAL_REVIEW", "CLIENT_APPROVAL", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  utmSource: z.string().max(80).nullable().optional(),
  utmMedium: z.string().max(80).nullable().optional(),
  utmCampaign: z.string().max(80).nullable().optional()
});

export const GET = authedRoute(
  null,
  async (ctx, _data, params) => {
    return CampaignService.get(ctx.orgId, params.id);
  }
);

export const PATCH = authedRoute<z.infer<typeof patchSchema>>(
  patchSchema,
  async (ctx, data, params) => {
    return CampaignService.proposeUpdate(ctx.orgId, ctx.userId, params.id, data);
  }
);
