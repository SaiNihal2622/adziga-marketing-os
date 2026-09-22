// Adziga — /api/clients/[id]
// GET single client with all relations.
// PATCH proposes an update — critical fields route through approval, others apply immediately.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ClientService } from "@/server/services/client-service";

const patchSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  businessModel: z.string().max(120).nullable().optional(),
  monthlyBudget: z.number().nonnegative().nullable().optional(),
  status: z.enum(["ONBOARDING", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
  tier: z.enum(["FREE", "PRO", "ZIGA_PLUS"]).optional(),
  creativePreference: z.enum(["AI_INHOUSE", "AI_DESIGNER", "MANUAL_ONLY"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  acquisitionGoal: z.number().int().positive().nullable().optional(),
  acquisitionGoalUnit: z.enum(["CUSTOMERS", "REVENUE", "LEADS", "QUALIFIED_LEADS"]).optional(),
  acquisitionGoalDeadline: z.string().datetime().nullable().optional()
});

export const GET = authedRoute(
  null,
  async (ctx, _data, params) => {
    return ClientService.get(ctx.orgId, params.id);
  }
);

export const PATCH = authedRoute<z.infer<typeof patchSchema>>(
  patchSchema,
  async (ctx, data, params) => {
    return ClientService.proposeUpdate(ctx.orgId, ctx.userId, params.id, data, {
      requestedByKind: "user"
    });
  }
);
