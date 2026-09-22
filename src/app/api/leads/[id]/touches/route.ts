// Adziga — /api/leads/[id]/touches
// Record a multi-touch attribution event (IMPRESSION / CLICK / FORM_SUBMIT / etc.).

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { AttributionService } from "@/server/services/attribution-service";

const schema = z.object({
  campaignId: z.string().min(1).optional().nullable(),
  creativeId: z.string().min(1).optional().nullable(),
  touchType: z.enum(["IMPRESSION", "CLICK", "VISIT", "FORM_SUBMIT", "QUALIFICATION", "RETARGET"]),
  metadata: z.record(z.unknown()).optional()
});

export const POST = authedRoute<z.infer<typeof schema>>(
  schema,
  async (ctx, data, params) => {
    return AttributionService.recordTouch({
      orgId: ctx.orgId,
      leadId: params.id,
      campaignId: data.campaignId ?? undefined,
      creativeId: data.creativeId ?? undefined,
      touchType: data.touchType,
      metadata: data.metadata
    });
  }
);

export const GET = authedRoute(
  null,
  async (ctx, _data, params) => {
    const { prisma } = await import("@/lib/db");
    return prisma.leadTouch.findMany({
      where: { orgId: ctx.orgId, leadId: params.id },
      orderBy: { touchedAt: "desc" },
      take: 100,
      include: { campaign: { select: { id: true, name: true, platform: true } } }
    });
  }
);
