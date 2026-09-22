// Adziga — /api/admin/policies/preview-target
// Returns the most recently created entity of the given type, so the policy
// preview UI has a real entityId to evaluate against.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { prisma } from "@/lib/db";

const querySchema = z.object({
  entityType: z.enum(["Client", "Campaign", "AdSet", "Strategy", "Integration"])
});

export const GET = authedRoute<z.infer<typeof querySchema>>(
  null,
  async (ctx) => {
    const entityType = ctx.req.nextUrl.searchParams.get("entityType");
    const validated = querySchema.parse({ entityType });

    let entityId: string | null = null;
    switch (validated.entityType) {
      case "Client":
        const c = await prisma.client.findFirst({
          where: { orgId: ctx.orgId },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        entityId = c?.id ?? null;
        break;
      case "Campaign":
        const camp = await prisma.campaign.findFirst({
          where: { orgId: ctx.orgId },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        entityId = camp?.id ?? null;
        break;
      case "AdSet":
        // AdSet has no direct orgId — go through campaign.
        const ads = await prisma.adSet.findFirst({
          where: { campaign: { orgId: ctx.orgId } },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        entityId = ads?.id ?? null;
        break;
      case "Strategy":
        const s = await prisma.strategy.findFirst({
          where: { orgId: ctx.orgId },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        entityId = s?.id ?? null;
        break;
      case "Integration":
        const i = await prisma.integration.findFirst({
          where: { orgId: ctx.orgId },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        entityId = i?.id ?? null;
        break;
    }

    return { entityId: entityId ?? "preview-only" };
  }
);
