// Adziga — /api/admin/webhooks/[id]/resolve
// Sprint 16d — mark a dead-lettered webhook as resolved. This is the
// "I've fixed the bug or confirmed it was a duplicate; close it out"
// action — it sets the delivery back to "processed" and clears the error.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";

const body = z.object({ note: z.string().max(2000).optional() });

export const POST = authedRoute<z.infer<typeof body>>(
  body,
  async (ctx, data, params) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    const delivery = await prisma.webhookDelivery.update({
      where: { id: params.id },
      data: {
        status: "processed",
        error: data.note ? `Resolved: ${data.note}` : "Manually resolved",
        processedAt: new Date()
      }
    });
    await audit(ctx.orgId, ctx.userId, "webhook.resolve", {
      entityType: "WebhookDelivery",
      entityId: delivery.id,
      after: { status: delivery.status }
    });
    return { delivery };
  }
);
