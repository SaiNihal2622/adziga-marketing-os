// Adziga — /api/clients (list + create)
// List scoped to org; create is direct (no approval — adding a brand-new client
// is an admin action by definition).

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ClientService } from "@/server/services/client-service";

const createSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  businessModel: z.string().max(120).nullable().optional(),
  monthlyBudget: z.number().nonnegative().nullable().optional()
});

export const GET = authedRoute(
  null,
  async (ctx) => {
    return ClientService.list(ctx.orgId);
  }
);

export const POST = authedRoute<z.infer<typeof createSchema>>(
  createSchema,
  async (ctx, data) => {
    return ClientService.create(ctx.orgId, ctx.userId, data);
  }
);
