// Adziga — Razorpay webhook receiver
// Public endpoint, signature verified.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/server/logger";
import { handleRazorpayEvent, verifyRazorpaySignature } from "@/server/billing/razorpay";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  if (!webhookSecret) {
    logger.error("billing.webhook_not_configured");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  if (!verifyRazorpaySignature(body, signature, webhookSecret)) {
    logger.warn("billing.webhook_bad_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);
  const eventId = event.event ?? "unknown";

  // Persist raw delivery. We update this row at the end with the final status.
  const delivery = await prisma.webhookDelivery.create({
    data: {
      provider: "razorpay",
      endpoint: "/api/webhooks/razorpay",
      signature,
      payload: body,
      status: "processing"
    }
  });

  try {
    const r = await handleRazorpayEvent(eventId, event.payload ?? event);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: r.processed ? "processed" : "failed",
        processedAt: new Date(),
        attempts: { increment: 1 },
        error: r.processed ? null : (r.reason ?? null)
      }
    });
    return NextResponse.json({ ok: r.processed, reason: r.reason });
  } catch (e: any) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        processedAt: new Date(),
        attempts: { increment: 1 },
        error: e.message ?? String(e)
      }
    });
    logger.error("billing.webhook_handler_failed", { event: eventId, error: e.message });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}