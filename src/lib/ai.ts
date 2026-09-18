// Adziga AI Service
// Spec ??23, ??34 - Assistant is NOT a strategy generator.
// Spec ??37 - AI has controlled access to client context, campaign data, reports, KPI definitions, approved strategy.
// It must NOT have unrestricted database access.
// Spec ??0 - Do not build fake AI. Distinguish human vs deterministic vs AI assistance vs recommendations vs autonomous.

import { prisma } from "./db";

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
  const model = process.env.GEMINI_API_KEY ? "gemini-stub" : "adziga-stub-v1";

  // Build a controlled, structured prompt from ONLY the supplied context.
  const sections: string[] = [];
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
  sections.push(`\nUser question: ${ctx.question}`);

  // Stub implementation: deterministic, traceable, honest about being an assistant.
  const response = stubAnswer(ctx, sections);

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
        kpis: ctx.kpis
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
  const q = ctx.question.toLowerCase();

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

  return "I'm Adziga Assistant - I can explain KPIs, summarize reports, and answer campaign questions based on the controlled context I'm given. I don't execute changes autonomously; if you need an action taken, please submit a request.";
}