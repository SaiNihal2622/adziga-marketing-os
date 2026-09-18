// Adziga — Meta (Facebook) Conversions API webhook receiver
// Receives lead notifications when forms are submitted on Facebook/Instagram.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/server/logger";
import { LeadService } from "@/server/services/lead-service";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";

  // Verify signature
  if (!verifyMetaSignature(body, signature, appSecret)) {
    logger.warn("meta.webhook_bad_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  await prisma.webhookDelivery.create({
    data: { provider: "meta", endpoint: "/api/webhooks/meta", signature, payload: body, status: "processing" }
  });

  // Parse the payload
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.object !== "page" || !Array.isArray(payload.entry)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Process each entry → each change → each leadgen event
  let leadCount = 0;
  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const value = change.value;
      const formId = value.form_id;
      const leadgenId = value.leadgen_id;
      if (!formId || !leadgenId) continue;

      // Fetch the lead from Meta
      const lead = await fetchMetaLead(formId, leadgenId);
      if (!lead) continue;

      // Find the org that owns this lead — for now, use the first org with a Meta integration
      const integration = await prisma.integration.findFirst({ where: { provider: "META", status: "HEALTHY" } });
      if (!integration) {
        logger.warn("meta.webhook_no_integration");
        continue;
      }

      // Map Meta fields to our schema
      const fields = lead.field_data ?? [];
      const get = (n: string) => fields.find((f: any) => f.name === n)?.values?.[0] ?? null;

      // Find the campaign
      const campaign = await prisma.campaign.findFirst({
        where: { orgId: integration.orgId, externalId: value.campaign_id }
      });
      if (!campaign) {
        logger.warn("meta.webhook_unknown_campaign", { campaignId: value.campaign_id });
        continue;
      }

      try {
        await LeadService.create(integration.orgId, "system", {
          clientId: campaign.clientId,
          campaignId: campaign.id,
          name: get("full_name") ?? get("name"),
          email: get("email"),
          phone: get("phone_number") ?? get("phone"),
          city: get("city"),
          source: "META_AD",
          utmSource: value.ad_id ? "meta" : undefined,
          utmMedium: "paid",
          utmCampaign: value.campaign_id,
          utmContent: value.ad_id,
          clickId: leadgenId,
          landingPage: undefined
        });
        leadCount++;
      } catch (e: any) {
        logger.error("meta.webhook_lead_create_failed", { error: e.message });
      }
    }
  }

  return NextResponse.json({ ok: true, leadsProcessed: leadCount });
}

// GET handler for Meta webhook verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

function verifyMetaSignature(payload: string, signature: string, appSecret: string): boolean {
  if (!appSecret || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function fetchMetaLead(formId: string, leadgenId: string): Promise<any | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${formId}/${leadgenId}?access_token=${token}&fields=field_data,ad_id,adset_id,campaign_id,created_time`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}