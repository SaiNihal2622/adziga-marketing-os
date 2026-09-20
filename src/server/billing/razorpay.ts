// Adziga — Razorpay billing integration
// Handles Indian market (INR). For international, see stripe.ts.

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/server/logger";
import { IntegrationError, NotFoundError, ConflictError } from "@/server/errors";
import { reserveNextInvoiceNumber } from "./invoice-number";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

function readConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret };
}

export function isRazorpayConfigured(): boolean {
  return readConfig() !== null;
}

function authHeader(cfg: RazorpayConfig): string {
  return "Basic " + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64");
}

// ──────────────────────────────────────────────────────────────────────────
// Plan definitions
// ──────────────────────────────────────────────────────────────────────────

export const PLAN_DEFINITIONS: Record<string, { monthlyInr: number; name: string; features: string[] }> = {
  FREE: {
    monthlyInr: 0,
    name: "Free",
    features: ["1 client account", "100 leads/mo", "1 channel integration", "Basic analytics"]
  },
  PRO: {
    monthlyInr: 4900,
    name: "Pro",
    features: ["10 client accounts", "10K leads/mo", "All channel integrations", "Strategy Intelligence (Phase 2)", "Content Intelligence (Phase 3)", "Automation workflows", "Priority support"]
  },
  ZIGA_PLUS: {
    monthlyInr: 24900,
    name: "Ziga Plus",
    features: ["Unlimited clients", "Unlimited leads", "All integrations + Vertex AI", "Marketing Orchestration (Phase 4)", "Dedicated success manager", "Custom workflows", "SLA-backed support"]
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Customer creation
// ──────────────────────────────────────────────────────────────────────────

export async function createOrGetRazorpayCustomer(orgId: string, email: string, name: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (sub?.providerSubId) return sub.providerSubId;

  const cfg = readConfig();
  if (!cfg) throw new IntegrationError("RAZORPAY", "not configured");

  // Create customer in Razorpay
  const r = await fetch(`${RAZORPAY_API}/customers`, {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, notes: { orgId } })
  });
  const j: any = await r.json();
  if (!r.ok) throw new IntegrationError("RAZORPAY", `customer create failed: ${j.error?.description ?? r.status}`);
  return j.id;
}

// ──────────────────────────────────────────────────────────────────────────
// Subscription creation
// ──────────────────────────────────────────────────────────────────────────

export async function createSubscription(orgId: string, plan: string): Promise<{
  subscriptionId: string;
  shortUrl: string;
}> {
  const cfg = readConfig();
  if (!cfg) throw new IntegrationError("RAZORPAY", "not configured");
  const planDef = PLAN_DEFINITIONS[plan];
  if (!planDef) throw new NotFoundError("Plan", plan);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError("Organization", orgId);

  // Look up primary user for customer info
  const user = await prisma.orgMember.findFirst({
    where: { orgId, role: "FOUNDER" },
    include: { user: true }
  });
  if (!user) throw new NotFoundError("Founder user");

  // Create subscription in Razorpay with a 12-month limit & customer notify
  const customerId = await createOrGetRazorpayCustomer(orgId, user.user.email, org.name);

  // Need a Razorpay Plan ID; create a plan dynamically per org or use preconfigured
  // For simplicity, use plan_id from env or create per request
  const planRzpId = process.env[`RAZORPAY_PLAN_${plan}`];
  let rzpSubscription: any;

  if (planRzpId) {
    const r = await fetch(`${RAZORPAY_API}/subscriptions`, {
      method: "POST",
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planRzpId, customer_notify: 1, quantity: 1, total_count: 12, notes: { orgId, plan } })
    });
    rzpSubscription = await r.json();
    if (!r.ok) throw new IntegrationError("RAZORPAY", `subscription failed: ${rzpSubscription.error?.description ?? r.status}`);
  } else {
    // Fallback: one-time invoice (for plans without subscription preconfiguration)
    const r = await fetch(`${RAZORPAY_API}/invoices`, {
      method: "POST",
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "link",
        amount: planDef.monthlyInr * 100,
        currency: "INR",
        description: `Adziga ${planDef.name} plan`,
        customer: { name: org.name, email: user.user.email },
        notify: { sms: false, email: true },
        reminder_enable: true,
        notes: { orgId, plan }
      })
    });
    rzpSubscription = await r.json();
    if (!r.ok) throw new IntegrationError("RAZORPAY", `invoice failed: ${rzpSubscription.error?.description ?? r.status}`);
  }

  await prisma.subscription.upsert({
    where: { orgId },
    update: {
      plan,
      status: "active",
      provider: "razorpay",
      providerSubId: rzpSubscription.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000)
    },
    create: {
      orgId,
      plan,
      status: "active",
      provider: "razorpay",
      providerSubId: rzpSubscription.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000)
    }
  });
  await prisma.organization.update({ where: { id: orgId }, data: { tier: plan as any } });

  return {
    subscriptionId: rzpSubscription.id,
    shortUrl: rzpSubscription.short_url
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Webhook signature verification
// ──────────────────────────────────────────────────────────────────────────

export function verifyRazorpaySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ──────────────────────────────────────────────────────────────────────────
// Webhook event handling
// ──────────────────────────────────────────────────────────────────────────

export async function handleRazorpayEvent(eventType: string, payload: any): Promise<{ processed: boolean; reason?: string }> {
  const eventId = payload.id ?? payload.payment_id ?? payload.subscription_id ?? "unknown";
  // Idempotency: check if already processed
  const existing = await prisma.paymentEvent.findUnique({ where: { providerId: eventId } });
  if (existing?.processed) return { processed: true, reason: "already processed" };

  await prisma.paymentEvent.upsert({
    where: { providerId: eventId },
    update: { type: eventType, payload: JSON.stringify(payload) },
    create: { provider: "razorpay", providerId: eventId, type: eventType, payload: JSON.stringify(payload) }
  });

  const notes = payload.notes ?? {};
  const orgId = notes.orgId;
  const plan = notes.plan;

  try {
    if (eventType === "subscription.activated" || eventType === "subscription.resumed") {
      if (orgId && plan) {
        await prisma.subscription.update({
          where: { orgId },
          data: { status: "active", plan }
        });
        const prev = await prisma.organization.findUnique({ where: { id: orgId }, select: { tier: true } });
        await prisma.organization.update({ where: { id: orgId }, data: { tier: plan as any } });
        // Audit tier change — important for SOC2/GST compliance.
        await prisma.auditLog.create({
          data: {
            orgId,
            action: "billing.tier_changed",
            entityType: "Organization",
            entityId: orgId,
            before: JSON.stringify({ tier: prev?.tier }),
            after: JSON.stringify({ tier: plan, source: "razorpay", eventType })
          }
        });
      }
    } else if (eventType === "subscription.charged" || eventType === "invoice.paid") {
      if (orgId) {
        // Generate invoice record with GST-compliant sequential numbering.
        const amount = (payload.payment?.amount ?? payload.amount ?? 0) / 100;
        const periodStart = new Date();
        const periodEnd = new Date(Date.now() + 30 * 86400_000);
        const subscriptionId = (await prisma.subscription.findUnique({ where: { orgId } }))?.id;
        const { number: invoiceNumber, financialYear } = await reserveNextInvoiceNumber(prisma, orgId);
        const invoice = await prisma.invoice.create({
          data: {
            orgId,
            subscriptionId,
            number: invoiceNumber,
            status: "PAID",
            amount,
            currency: "INR",
            periodStart,
            periodEnd,
            paidAt: new Date(),
            providerInvoiceId: payload.payment_id ?? payload.id,
            notes: JSON.stringify({ financialYear, plan })
          }
        });
        await prisma.auditLog.create({
          data: {
            orgId,
            action: "billing.invoice.created",
            entityType: "Invoice",
            entityId: invoice.id,
            after: JSON.stringify({ number: invoiceNumber, amount, financialYear })
          }
        });
      }
    } else if (eventType === "subscription.cancelled" || eventType === "subscription.halted") {
      if (orgId) {
        await prisma.subscription.update({
          where: { orgId },
          data: { status: "canceled", canceledAt: new Date() }
        });
        // Don't downgrade immediately — grace period handled elsewhere
        await prisma.auditLog.create({
          data: {
            orgId,
            action: "billing.subscription.cancelled",
            entityType: "Subscription",
            entityId: orgId,
            after: JSON.stringify({ source: "razorpay", eventType })
          }
        });
      }
    } else if (eventType === "payment.failed") {
      if (orgId) {
        await sendEmail({
          to: (await prisma.user.findFirst({ where: { memberships: { some: { orgId } } } }))?.email ?? "",
          template: "payment_failed",
          variables: { plan, amount: (payload.payment?.amount ?? 0) / 100, appUrl: process.env.APP_URL ?? "https://app.adziga.in" }
        }).catch(() => null);
        await prisma.auditLog.create({
          data: {
            orgId,
            action: "billing.payment.failed",
            entityType: "PaymentEvent",
            entityId: eventId,
            after: JSON.stringify({ plan, amount: (payload.payment?.amount ?? 0) / 100 })
          }
        });
      }
    }

    await prisma.paymentEvent.update({ where: { providerId: eventId }, data: { processed: true, processedAt: new Date() } });
    return { processed: true };
  } catch (e: any) {
    logger.error("billing.razorpay_event_failed", { eventType, eventId, error: e.message });
    return { processed: false, reason: e.message };
  }
}

// Helper to send email from outside the email module (avoid circular import)
async function sendEmail(args: any): Promise<any> {
  const { sendEmail } = await import("@/server/email");
  return sendEmail(args);
}