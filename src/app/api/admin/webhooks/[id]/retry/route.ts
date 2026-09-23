// Adziga — /api/admin/webhooks/[id]/retry
// Sprint 14a — manual retry of a failed webhook. POST re-runs the
// payload through the same handler pipeline.
//
// Idempotency: if the same webhook was already retried successfully,
// subsequent retries are no-ops.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const POST = authedRoute(null, async (ctx, _body, params) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: params.id } });
  if (!delivery) return { error: "delivery not found" } as any;

  if (delivery.attempts >= 5) {
    // Move to dead-letter queue.
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "dead_letter", deadLetteredAt: new Date(), lastAttemptAt: new Date() }
    });
    return { error: "max retry attempts (5) reached; moved to dead-letter queue" } as any;
  }
  if (delivery.status === "processed") {
    return { ok: true, skipped: true, reason: "already processed" };
  }

  // Mark in-progress and bump attempts
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      error: null
    }
  });

  // Replay by invoking the handler logic with the original payload.
  try {
    if (delivery.provider === "razorpay") {
      const { handleRazorpayEvent } = await import("@/server/billing/razorpay");
      const event = JSON.parse(delivery.payload);
      const eventId = event.event ?? "unknown";
      const result = await handleRazorpayEvent(eventId, event.payload ?? event);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.processed ? "processed" : "failed",
          processedAt: new Date(),
          error: result.processed ? null : (result.reason ?? null)
        }
      });
      return { ok: result.processed, reason: result.reason };
    }
    if (delivery.provider === "meta") {
      const { LeadService } = await import("@/server/services/lead-service");
      const event = JSON.parse(delivery.payload);
      let leadCount = 0;
      if (event.object === "page" && Array.isArray(event.entry)) {
        for (const entry of event.entry) {
          for (const change of entry.changes ?? []) {
            if (change.field !== "leadgen") continue;
            const integration = await prisma.integration.findFirst({
              where: { provider: "META", status: "HEALTHY" }
            });
            if (!integration) continue;
            const campaign = await prisma.campaign.findFirst({
              where: { orgId: integration.orgId, externalId: change.value?.campaign_id }
            });
            if (!campaign) continue;
            const lead = await fetch(
              `https://graph.facebook.com/v19.0/${change.value?.form_id}/${change.value?.leadgen_id}?access_token=${process.env.META_ACCESS_TOKEN}&fields=field_data`
            ).then((r) => r.ok ? r.json() : null).catch(() => null);
            if (!lead) continue;
            const fields = lead.field_data ?? [];
            const get = (n: string) => fields.find((f: any) => f.name === n)?.values?.[0] ?? null;
            await LeadService.create(integration.orgId, "system", {
              clientId: campaign.clientId,
              campaignId: campaign.id,
              name: get("full_name") ?? get("name"),
              email: get("email"),
              phone: get("phone_number") ?? get("phone"),
              city: get("city"),
              source: "META_AD",
              utmSource: change.value?.ad_id ? "meta" : undefined,
              utmMedium: "paid",
              utmCampaign: change.value?.campaign_id,
              utmContent: change.value?.ad_id,
              clickId: change.value?.leadgen_id,
              landingPage: undefined
            });
            leadCount++;
          }
        }
      }
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "processed", processedAt: new Date() }
      });
      return { ok: true, leadsProcessed: leadCount };
    }
    return { error: `retry not implemented for provider "${delivery.provider}"` } as any;
  } catch (e: any) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", error: e.message ?? String(e), processedAt: new Date() }
    });
    return { error: e.message ?? String(e) } as any;
  }
});
