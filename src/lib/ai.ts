// Adziga AI Service
// Spec ??23, ??34 - Assistant is NOT a strategy generator.
// Spec ??37 - AI has controlled access to client context, campaign data, reports, KPI definitions, approved strategy.
// It must NOT have unrestricted database access.
// Spec ??0 - Do not build fake AI. Distinguish human vs deterministic vs AI assistance vs recommendations vs autonomous.

import { prisma } from "./db";
import type { MMMResult, AttributionResult, LeadScoreResult } from "./analytics";

export type AIContext = {
  orgId: string;
  clientId?: string;
  campaignIds?: string[];
  question: string;
  userId: string;
  // Optional pre-fetched context (caller responsible for filtering)
  client?: { id: string; businessName: string; industry: string | null } | null;
  reports?: Array<{ title: string; periodStart: Date; periodEnd: Date; executiveSummary: string | null }>;
  campaignStats?: Array<{ id: string; name: string; platform: string; spend: number; leads: number; cpl: number; status: string }>;
  kpis?: { cpl: number; cac: number; roas: number; conversion: number };
  // Phase 4 deep analytics (pre-computed server-side, passed as read-only context)
  mmm?: MMMResult;
  attribution?: { leadsAnalyzed: number; channelTotals: Record<string, number> };
  leadScores?: LeadScoreResult[];
};

const SYSTEM_PROMPT = `You are Adziga Assistant, a marketing analytics helper for a marketing operating system.

CORE RULES:
1. You are an ASSISTANT, not a strategy generator. You do not autonomously create or change marketing strategy.
2. You explain KPIs, summarize reports, answer campaign questions, and clarify terminology using ONLY the structured context you were given.
3. If a user asks you to change a campaign, budget, creative, or strategy, DO NOT pretend you did. Respond: "I cannot execute that. I can submit it as a request for the Adziga team."
4. Do not invent metrics. If a value is missing from the context, say "I don't have that data in the current report."
5. Format numeric values as INR using  and the Indian number system (lakh/crore) where helpful.
6. Keep responses short, factual, professional.
7. If you suspect the user wants an action that requires approval, suggest they use the Requests feature.

CONTEXT:
The user is in an Adziga organization. You have been given a controlled snapshot of authorized context. You do NOT have direct database access. You cannot query anything else.`;

export async function askAssistant(ctx: AIContext): Promise<{
  response: string;
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}> {
  const start = Date.now();

  // Build a controlled, structured prompt from ONLY the supplied context.
  const sections: string[] = [SYSTEM_PROMPT];
  if (ctx.client) {
    sections.push(`Client: ${ctx.client.businessName} (${ctx.client.industry ?? "industry not set"})`);
  }
  if (ctx.campaignStats?.length) {
    sections.push("Campaign snapshot (read-only):");
    for (const c of ctx.campaignStats) {
      sections.push(
        `- [${c.platform}] ${c.name} - status=${c.status}, spend=${c.spend.toFixed(0)}, leads=${c.leads}, CPL=${c.cpl.toFixed(0)}`
      );
    }
  }
  if (ctx.kpis) {
    sections.push(
      `Aggregate KPIs: CPL ${ctx.kpis.cpl.toFixed(0)} | CAC ${ctx.kpis.cac.toFixed(0)} | ROAS ${ctx.kpis.roas.toFixed(2)}x | Conversion ${ctx.kpis.conversion.toFixed(1)}%`
    );
  }
  if (ctx.reports?.length) {
    sections.push("Most recent reports:");
    for (const r of ctx.reports.slice(0, 3)) {
      sections.push(`- ${r.title} (${r.periodStart.toISOString().slice(0, 10)}  ${r.periodEnd.toISOString().slice(0, 10)}): ${r.executiveSummary ?? "(no summary)"}`);
    }
  }
  if (ctx.mmm?.rows?.length) {
    sections.push(
      `Marketing Mix Model (last 90d, Ridge regression with adstock transformation): baseline=${ctx.mmm.baseline.toFixed(0)} | totalRevenue=${ctx.mmm.totalRevenue.toFixed(0)} | totalSpend=${ctx.mmm.totalSpend.toFixed(0)} | overallROI=${ctx.mmm.overallROI.toFixed(2)}x`
    );
    const top = [...ctx.mmm.rows]
      .filter((r) => r.totalSpend > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 3);
    for (const r of top) {
      sections.push(
        `  - [${r.channel}] ROI=${r.roi.toFixed(2)}x | spend=${r.totalSpend.toFixed(0)} | attributedRevenue=${r.attributedRevenue.toFixed(0)} | confidence=${(r.confidence * 100).toFixed(0)}%`
      );
    }
    if (ctx.mmm.recommendedReallocation?.length) {
      for (const r of ctx.mmm.recommendedReallocation.slice(0, 3)) {
        sections.push(`  - reallocation ${r.channel}: ${r.currentShare.toFixed(2)} -> ${r.recommendedShare.toFixed(2)} (${r.reason})`);
      }
    }
  }
  if (ctx.attribution && Object.keys(ctx.attribution.channelTotals).length) {
    sections.push(
      `Multi-touch Attribution (Shapley values, last 90d, ${ctx.attribution.leadsAnalyzed} leads):`
    );
    const sorted = Object.entries(ctx.attribution.channelTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [ch, credit] of sorted) {
      sections.push(`  - ${ch}: ${(credit * 100).toFixed(1)}% credit`);
    }
  }
  if (ctx.leadScores?.length) {
    const top = [...ctx.leadScores].sort((a, b) => b.probability - a.probability).slice(0, 3);
    sections.push(`Top-scored leads (logistic regression):`);
    for (const s of top) {
      sections.push(
        `  - ${s.leadId.slice(0, 12)}... score=${s.score} | P(convert)=${(s.probability * 100).toFixed(0)}% | topFactor=${s.topFactors[0]?.feature} (${s.topFactors[0]?.direction})`
      );
    }
  }
  sections.push(`\nUser question: ${ctx.question}`);

  // Live LLM if GEMINI_API_KEY set; fall back to deterministic stub otherwise.
  const geminiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
  let model = "adziga-stub-v1";
  let response = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  if (geminiKey) {
    try {
      const r = await callGemini(geminiKey, sections.join("\n\n"));
      if (r) {
        model = "gemini-flash-latest";
        response = r.text;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
      }
    } catch (e) {
      // Gemini failed — fall back to stub so the user still gets an answer.
      console.error("gemini_failed", e);
    }
  }

  if (!response) {
    response = stubAnswer(ctx, sections);
  }

  const latencyMs = Date.now() - start;

  await prisma.aIInteraction.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      mode: "ASSISTANT",
      prompt: ctx.question,
      context: JSON.stringify({
        clientId: ctx.clientId,
        campaignIds: ctx.campaignIds,
        kpis: ctx.kpis,
        mmm: ctx.mmm ? { rows: ctx.mmm.rows.length } : null,
        attribution: ctx.attribution?.leadsAnalyzed ?? null,
        leadScores: ctx.leadScores?.length ?? 0
      }),
      response,
      model,
      promptVersion: "v1.0",
      latencyMs
    }
  });

  return { response, model, latencyMs };
}

function stubAnswer(ctx: AIContext, sections: string[]): string {
  const q = ctx.question.toLowerCase().trim();

  // Greetings / chitchat — first to handle, otherwise every "hi" falls through
  // to the long "I'm Adziga Assistant..." paragraph which feels cold.
  if (/^(hi|hello|hey|yo|hola|namaste|namaskar|good\s+(morning|afternoon|evening))\b/.test(q) || q.length < 4) {
    const greet = q.includes("namaste") || q.includes("namaskar")
      ? "Namaste! I'm Adziga Assistant."
      : "Hi! I'm Adziga Assistant.";
    const ctx_ = ctx.client ? ` I see you're working on ${ctx.client.businessName}.` : " I see you don't have any clients onboarded yet — start by adding one.";
    return `${greet}${ctx_} Ask me about CPL, ROAS, campaign status, attribution, or budget reallocation.`;
  }

  if (q.includes("change") || q.includes("update") || q.includes("modify") || q.includes("pause") || q.includes("scale") || q.includes("launch")) {
    return "I cannot execute that change directly. As per Adziga's governance policy, AI suggestions never bypass human approval. I can submit this as a request - would you like me to create a ticket for the Adziga team?";
  }

  if (q.includes("cpl") || q.includes("cost per lead")) {
    const cpl = ctx.kpis?.cpl ?? 0;
    const trend = cpl > 500 ? "above the typical industry benchmark for the channel" : "within an acceptable range";
    return `Current CPL is ${cpl.toFixed(0)}, which is ${trend}. This figure comes from the latest campaign snapshot; if you'd like a per-campaign breakdown, open Analytics  Campaigns.`;
  }

  if (q.includes("roas") || q.includes("return")) {
    const roas = ctx.kpis?.roas ?? 0;
    return `ROAS is currently ${roas.toFixed(2)}x. ROAS measures revenue per rupee of ad spend - anything above 3x is generally strong for direct-response campaigns.`;
  }

  if (q.includes("lead") && (q.includes("quality") || q.includes("qualified"))) {
    if (ctx.leadScores?.length) {
      const top = [...ctx.leadScores].sort((a, b) => b.probability - a.probability).slice(0, 3);
      const lines = top.map((s) => ` ${s.leadId.slice(0, 12)}... P(convert)=${(s.probability * 100).toFixed(0)}% (top factor: ${s.topFactors[0]?.feature})`);
      return `Top-scored leads from the logistic-regression model:\n` + lines.join("\n");
    }
    return "Lead quality is tracked per source via the qualification  meeting  proposal  customer lifecycle. Open Reports  Lead Quality to see conversion rates by source and campaign. AI-generated lead scoring is a Phase 2 capability.";
  }

  if (q.includes("summary") || q.includes("report")) {
    const r = ctx.reports?.[0];
    if (!r) return "I don't have a recent report in the current context. Open Reports to view the latest.";
    return `Latest report: "${r.title}" (${r.executiveSummary ?? "no summary provided"}). For full breakdown see Reports.`;
  }

  if (q.includes("status") && ctx.campaignStats?.length) {
    const lines = ctx.campaignStats.slice(0, 5).map((c) => ` ${c.name}: ${c.status}`);
    return "Current campaign statuses:\n" + lines.join("\n");
  }

  // Analytics-grounded answers (Phase 4)
  if ((q.includes("best") || q.includes("top") || q.includes("highest")) && (q.includes("channel") || q.includes("performing") || q.includes("roi"))) {
    if (ctx.mmm?.rows?.length) {
      const top = [...ctx.mmm.rows].filter((r) => r.totalSpend > 0).sort((a, b) => b.roi - a.roi).slice(0, 3);
      const lines = top.map((r, i) => ` ${i + 1}. ${r.channel} - ROI ${r.roi.toFixed(2)}x on ${r.totalSpend.toFixed(0)} spend (confidence ${(r.confidence * 100).toFixed(0)}%)`);
      return `Top channels by ROI (Marketing Mix Model, 90-day window):\n` + lines.join("\n");
    }
  }

  if (q.includes("reallocate") || q.includes("reallocation") || q.includes("budget shift")) {
    if (ctx.mmm?.recommendedReallocation?.length) {
      const lines = ctx.mmm.recommendedReallocation.slice(0, 5).map((r) => ` ${r.channel}: ${(r.currentShare * 100).toFixed(0)}% -> ${(r.recommendedShare * 100).toFixed(0)}% - ${r.reason}`);
      return `Recommended budget reallocation (Thompson sampling + Ridge):\n` + lines.join("\n") + `\n\nThese are recommendations, not actions. Submit a request to the team to enact.`;
    }
  }

  if (q.includes("attribution") || (q.includes("which channel") && q.includes("credit"))) {
    if (ctx.attribution && Object.keys(ctx.attribution.channelTotals).length) {
      const sorted = Object.entries(ctx.attribution.channelTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const lines = sorted.map(([ch, credit]) => ` ${ch}: ${(credit * 100).toFixed(1)}%`);
      return `Multi-touch attribution (Shapley values, ${ctx.attribution.leadsAnalyzed} leads):\n` + lines.join("\n");
    }
  }

  return "I'm Adziga Assistant - I can explain KPIs, summarize reports, answer attribution/MMM questions, and clarify terminology using the controlled analytics context I was given. I don't execute changes autonomously; if you need an action taken, please submit a request.";
}

/**
 * Call Gemini via REST. Returns null on failure so callers can fall back
 * to the deterministic stub. 30-second timeout.
 *
 * Spec: "AI has controlled access to context". We send the full structured
 * prompt (system + context + question) — never raw user data or the whole DB.
 *
 * Model: "gemini-flash-latest" rolls forward to the newest stable flash
 * release. Older versions like "gemini-2.5-flash" are being deprecated
 * for new accounts; the latest alias survives the transition.
 */
async function callGemini(
  apiKey: string,
  prompt: string
): Promise<{ text: string; tokensIn?: number; tokensOut?: number } | null> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          topP: 0.9,
          topK: 40
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      console.error("gemini_http_error", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const data = (await r.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("").trim();
    const usage = data?.usageMetadata;
    return {
      text: text || "",
      tokensIn: usage?.promptTokenCount,
      tokensOut: usage?.candidatesTokenCount
    };
  } catch (e) {
    console.error("gemini_call_failed", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}