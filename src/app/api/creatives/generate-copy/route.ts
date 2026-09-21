// /api/creatives/generate-copy — AI copy generation via Gemini
//
// Returns { creatives: [{ name, headline, primaryCopy, cta, ...}, ...] }
// The caller picks one (or more) and POSTs to /api/creatives to persist.
import { authedRoute } from "@/server/api";
import { generateCopySchema } from "@/server/schemas";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a senior copywriter at Adziga, a marketing agency. You write platform-aware ad copy that converts.

Rules:
- Match the requested tone exactly.
- Honor the requested count — return that many distinct variants, never fewer.
- Each variant must include: name (short internal label, ≤60 chars), hook (≤80 chars — the line that stops the scroll), headline (≤60 chars), primaryCopy (≤800 chars), cta (≤24 chars, action verb).
- For META: lead with hook, headline repeats the hook's promise, body is conversational, cta is "Shop now" / "Learn more" / "Sign up" / etc.
- For GOOGLE: headline is benefit-led, body is feature→benefit, cta is intent-matching.
- For WHATSAPP: conversational, 1-2 sentences, soft cta like "Reply YES to order".
- For INFLUENCER: first-person, casual, mention the brand naturally.
- For LINKEDIN: B2B tone, focus on outcomes.
- For EMAIL: subject + preview text in headline, body is short and direct.
- Use the brand voice: avoid generic superlatives, prefer specifics (numbers, social proof, timeframes).

Return strict JSON only: { "variants": [ { "name": ..., "hook": ..., "headline": ..., "primaryCopy": ..., "cta": ... }, ... ] }`;

export const POST = authedRoute(generateCopySchema, async (ctx, body) => {
  // Normalize defaults so the rest of the function can use definite values.
  const platform = body.platform ?? "META";
  const format = body.format ?? "IMAGE";
  const tone = body.tone ?? "luxury";
  const count = body.count ?? 3;
  const apiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
  const normalized = { ...body, platform, format, tone, count };
  if (!apiKey) {
    return { variants: stubCopyVariants(normalized) };
  }

  // Pull client/campaign context if available
  let clientCtx = "";
  if (body.clientId) {
    const client = await prisma.client.findFirst({ where: { id: body.clientId, orgId: ctx.orgId } });
    if (client) clientCtx = `Client: ${client.businessName} (${client.industry ?? "industry not set"})`;
  }
  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({ where: { id: body.campaignId, orgId: ctx.orgId } });
    if (campaign) clientCtx += `\nCampaign: ${campaign.name} (${campaign.platform}, objective ${campaign.objective ?? "n/a"})`;
  }

  const userPrompt = `${clientCtx ? clientCtx + "\n\n" : ""}Brief: ${body.brief}
Platform: ${platform}
Format: ${format}
Tone: ${tone}
Count: ${count} variants

Return JSON.`;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4000,
            topP: 0.95,
            responseMimeType: "application/json"
          }
        }),
        signal: ctrl.signal
      }
    );
    if (!r.ok) {
      const err = await r.text();
      console.error("gemini_copy_http_error", r.status, err.slice(0, 300));
      return { variants: stubCopyVariants(normalized), warning: `Gemini ${r.status} — served stub variants` };
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed: { variants?: any[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini may have wrapped JSON in markdown — strip and retry
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const variants = Array.isArray(parsed.variants) ? parsed.variants.slice(0, count) : stubCopyVariants(normalized);
    return { variants: variants.map(normalizeVariant), model: "gemini-flash-latest" };
  } catch (e: any) {
    console.error("gemini_copy_failed", e);
    return { variants: stubCopyVariants(normalized), warning: `Gemini timeout/error — served stub variants` };
  } finally {
    clearTimeout(timeout);
  }
});

function normalizeVariant(v: any) {
  return {
    name: String(v.name ?? "Untitled variant").slice(0, 60),
    hook: String(v.hook ?? "").slice(0, 80),
    headline: String(v.headline ?? "").slice(0, 60),
    primaryCopy: String(v.primaryCopy ?? "").slice(0, 800),
    cta: String(v.cta ?? "Learn more").slice(0, 24),
    audience: v.audience ? String(v.audience).slice(0, 200) : undefined
  };
}

function stubCopyVariants(body: { brief: string; count: number; tone: string; platform: string }) {
  const stub = (i: number) => ({
    name: `${body.platform} ${body.tone} #${i + 1}`,
    hook: body.brief.slice(0, 80),
    headline: body.brief.slice(0, 60),
    primaryCopy: `${body.brief}\n\nThis is a stub variant — Gemini returned an error. Edit me.`,
    cta: "Learn more",
    audience: undefined
  });
  return Array.from({ length: body.count }, (_, i) => stub(i));
}
