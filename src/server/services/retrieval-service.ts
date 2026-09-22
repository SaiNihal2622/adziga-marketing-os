// Adziga — Retrieval Service
// "Adziga finds similar past situations" — the learning loop.
// Searches the org's institutional memory for past decisions, experiments,
// and outcomes that resemble the current context. The Strategy Agent
// reasons from precedent instead of generic LLM knowledge.
//
// "Semantic" search here is a token-overlap + keyword boost heuristic
// (no embeddings yet — that comes when we have enough history to justify
// the infrastructure cost). It's good enough for ~thousands of records,
// which is what we'll realistically have in the first year. When the
// org crosses ~10k history rows, swap in pgvector + embedding model.

import { prisma } from "@/lib/db";

export type PrecedentKind =
  | "decision"
  | "experiment"
  | "approval"
  | "strategy"
  | "lead_outcome"
  | "campaign_outcome";

export type Precedent = {
  kind: PrecedentKind;
  id: string;
  title: string;
  summary: string;
  context: string;
  outcome: string | null;
  similarity: number;
  when: Date;
  // Optional structured refs so the agent can pull more if needed
  refs: {
    clientId?: string;
    campaignId?: string;
    clientName?: string;
    campaignName?: string;
    outcomeType?: "success" | "failure" | "neutral";
  };
};

export type RetrievalInput = {
  orgId: string;
  query: string;
  clientId?: string;
  campaignId?: string;
  // Limit total results across kinds. Default 12.
  limit?: number;
  // Bias recent results (mild recency multiplier). Default true.
  preferRecent?: boolean;
};

const KIND_LIMITS: Record<PrecedentKind, number> = {
  decision: 4,
  experiment: 3,
  approval: 2,
  strategy: 2,
  lead_outcome: 4,
  campaign_outcome: 3
};

export const RetrievalService = {
  /**
   * Search institutional memory for past situations relevant to the query.
   * Returns a mixed bag of decisions, experiments, strategies, etc., each
   * with a similarity score.
   */
  async search(input: RetrievalInput): Promise<Precedent[]> {
    const tokens = tokenize(input.query);
    if (tokens.length === 0) return [];

    const limit = input.limit ?? 12;
    const preferRecent = input.preferRecent ?? true;
    const orgId = input.orgId;
    const since = new Date(Date.now() - 180 * 86_400_000); // 6 months

    // Run each kind in parallel
    const [decisions, experiments, approvals, strategies, leadOutcomes, campaignOutcomes] = await Promise.all([
      searchDecisions(orgId, tokens, input),
      searchExperiments(orgId, tokens, input, since),
      searchApprovals(orgId, tokens, input, since),
      searchStrategies(orgId, tokens, input, since),
      searchLeadOutcomes(orgId, tokens, input, since),
      searchCampaignOutcomes(orgId, tokens, input, since)
    ]);

    const all: Precedent[] = [
      ...decisions,
      ...experiments,
      ...approvals,
      ...strategies,
      ...leadOutcomes,
      ...campaignOutcomes
    ];

    // Cap each kind so one source doesn't dominate
    const capped = capByKind(all, KIND_LIMITS);

    // Recency boost
    if (preferRecent) {
      for (const p of capped) {
        const daysAgo = (Date.now() - p.when.getTime()) / 86_400_000;
        const recencyMultiplier = Math.max(0.7, 1 - daysAgo / 180); // 1.0 today, 0.7 at 180d
        p.similarity = p.similarity * recencyMultiplier;
      }
    }

    capped.sort((a, b) => b.similarity - a.similarity);
    return capped.slice(0, limit);
  },

  /**
   * Format precedents as a context block that can be appended to a system
   * prompt. The Strategy Agent calls this with its current understanding of
   * the situation, and the returned block becomes "what we know from
   * precedent" in the prompt.
   */
  async formatForPrompt(input: RetrievalInput): Promise<string> {
    const precedents = await this.search(input);
    if (precedents.length === 0) {
      return "No relevant precedent found for this situation yet — recommend as a fresh decision and capture the outcome for future reference.";
    }

    const groups = new Map<PrecedentKind, Precedent[]>();
    for (const p of precedents) {
      const list = groups.get(p.kind) ?? [];
      list.push(p);
      groups.set(p.kind, list);
    }

    const lines: string[] = [];
    lines.push("Precedent from prior Adziga decisions, experiments, and outcomes:");
    for (const [kind, items] of groups) {
      lines.push("");
      lines.push(`## ${humanizeKind(kind)}`);
      for (const p of items.slice(0, KIND_LIMITS[kind])) {
        const outcome = p.outcome ? ` -> outcome: ${p.outcome}` : "";
        lines.push(`- (${(p.similarity * 100).toFixed(0)}%) ${p.title} [${fmtRel(p.when)}]${outcome}`);
        if (p.summary && p.summary !== p.title) lines.push(`    ${p.summary}`);
        if (p.context && p.context.length < 200) lines.push(`    context: ${p.context}`);
      }
    }
    return lines.join("\n");
  }
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
    .filter((t) => !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "have", "has", "was", "were",
  "are", "but", "not", "you", "your", "can", "all", "any", "our", "out", "should",
  "would", "could", "will", "shall", "may", "might", "must", "what", "when", "where",
  "which", "who", "whom", "how", "why", "into", "than", "then", "about", "across"
]);

function score(query: string[], text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const tok of query) {
    if (lower.includes(tok)) hits++;
  }
  // Normalise by query length and boost by density
  return (hits / Math.max(1, query.length)) * (1 + Math.log(1 + hits));
}

function capByKind(items: Precedent[], limits: Record<PrecedentKind, number>): Precedent[] {
  const out: Precedent[] = [];
  const seen = new Map<PrecedentKind, number>();
  for (const p of items) {
    const count = seen.get(p.kind) ?? 0;
    if (count < limits[p.kind]) {
      out.push(p);
      seen.set(p.kind, count + 1);
    }
  }
  return out;
}

function humanizeKind(k: PrecedentKind): string {
  return {
    decision: "Past decisions",
    experiment: "Past experiments",
    approval: "Approved/rejected changes",
    strategy: "Strategy versions",
    lead_outcome: "Lead outcomes",
    campaign_outcome: "Campaign outcomes"
  }[k];
}

function fmtRel(d: Date): string {
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

// ─────────────────────────────────────────────────────────────────────────
// Per-kind searchers
// ─────────────────────────────────────────────────────────────────────────

async function searchDecisions(orgId: string, tokens: string[], input: RetrievalInput): Promise<Precedent[]> {
  const where: any = { orgId };
  if (input.clientId) where.clientId = input.clientId;
  if (input.campaignId) where.campaignId = input.campaignId;

  const rows = await prisma.decisionLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      client: { select: { businessName: true } },
      campaign: { select: { name: true } }
    }
  });

  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.decisionType} ${r.decision} ${r.reason ?? ""} ${r.expectedOutcome ?? ""} ${r.actualOutcome ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    out.push({
      kind: "decision",
      id: r.id,
      title: `${r.decisionType.replace(/_/g, " ")} — ${r.decision.slice(0, 100)}`,
      summary: r.reason ?? "",
      context: r.expectedOutcome ?? "",
      outcome: r.actualOutcome ?? null,
      similarity: s,
      when: r.createdAt,
      refs: {
        clientId: r.clientId ?? undefined,
        campaignId: r.campaignId ?? undefined,
        clientName: r.client?.businessName,
        campaignName: r.campaign?.name,
        outcomeType: r.evaluation === "good" ? "success" : r.evaluation === "bad" ? "failure" : "neutral"
      }
    });
  }
  return out;
}

async function searchExperiments(orgId: string, tokens: string[], input: RetrievalInput, since: Date): Promise<Precedent[]> {
  const where: any = { orgId, createdAt: { gte: since } };
  if (input.clientId) where.clientId = input.clientId;

  const rows = await prisma.experiment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { client: { select: { businessName: true } } }
  });
  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.hypothesis ?? ""} ${r.actualResult ?? ""} ${r.expectedResult ?? ""} ${r.conclusion ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    const outcome = r.actualResult ?? r.conclusion ?? null;
    out.push({
      kind: "experiment",
      id: r.id,
      title: r.hypothesis ?? "Experiment",
      summary: outcome ?? "",
      context: r.expectedResult ?? "",
      outcome,
      similarity: s,
      when: r.createdAt,
      refs: {
        clientId: r.clientId ?? undefined,
        clientName: r.client?.businessName,
        outcomeType: outcome && /increase|won|success|positive/i.test(outcome) ? "success" : outcome && /fail|drop|negative/i.test(outcome) ? "failure" : "neutral"
      }
    });
  }
  return out;
}

async function searchApprovals(orgId: string, tokens: string[], input: RetrievalInput, since: Date): Promise<Precedent[]> {
  const where: any = { orgId, decidedAt: { not: null, gte: since }, status: { in: ["applied", "rejected"] } };
  const rows = await prisma.approval.findMany({
    where,
    orderBy: { decidedAt: "desc" },
    take: 40
  });
  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.title} ${r.reason ?? ""} ${r.notes ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    out.push({
      kind: "approval",
      id: r.id,
      title: r.title,
      summary: r.notes ?? "",
      context: r.reason ?? "",
      outcome: r.status === "applied" ? "applied" : "rejected",
      similarity: s,
      when: r.decidedAt ?? r.requestedAt,
      refs: {
        clientId: r.entityType === "Client" ? r.entityId : undefined,
        campaignId: r.entityType === "Campaign" ? r.entityId : undefined,
        outcomeType: r.status === "applied" ? "success" : "failure"
      }
    });
  }
  return out;
}

async function searchStrategies(orgId: string, tokens: string[], input: RetrievalInput, since: Date): Promise<Precedent[]> {
  const where: any = { orgId, createdAt: { gte: since } };
  if (input.clientId) where.clientId = input.clientId;

  const rows = await prisma.strategy.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { client: { select: { businessName: true } } }
  });
  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.title} ${r.businessObjective ?? ""} ${r.campaignObjective ?? ""} ${r.channels ?? ""} ${r.creativeStrategy ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    out.push({
      kind: "strategy",
      id: r.id,
      title: `v${r.version} — ${r.title}`,
      summary: r.businessObjective ?? "",
      context: r.channels ?? "",
      outcome: r.status,
      similarity: s,
      when: r.createdAt,
      refs: {
        clientId: r.clientId ?? undefined,
        clientName: r.client?.businessName,
        outcomeType: r.status === "APPROVED" ? "success" : r.status === "ARCHIVED" ? "failure" : "neutral"
      }
    });
  }
  return out;
}

async function searchLeadOutcomes(orgId: string, tokens: string[], input: RetrievalInput, since: Date): Promise<Precedent[]> {
  const where: any = { orgId, status: { in: ["WON", "LOST"] }, createdAt: { gte: since } };
  if (input.clientId) where.clientId = input.clientId;

  const rows = await prisma.lead.findMany({
    where,
    orderBy: { convertedAt: "desc" },
    take: 60,
    include: { client: { select: { businessName: true } }, campaign: { select: { name: true } } }
  });
  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.name ?? ""} ${r.email ?? ""} ${r.city ?? ""} ${r.source ?? ""} ${r.qualificationData ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    out.push({
      kind: "lead_outcome",
      id: r.id,
      title: `${r.status === "WON" ? "Won" : "Lost"} lead — ${r.name ?? r.email ?? "anon"} (${r.source ?? "?"})`,
      summary: r.qualificationData ?? "",
      context: `City: ${r.city ?? "—"}. Source: ${r.source ?? "—"}.`,
      outcome: r.status === "WON" ? `Revenue ₹${r.revenue.toLocaleString("en-IN")}` : "Lost",
      similarity: s,
      when: r.convertedAt ?? r.createdAt,
      refs: {
        clientId: r.clientId ?? undefined,
        campaignId: r.campaignId ?? undefined,
        clientName: r.client?.businessName,
        campaignName: r.campaign?.name,
        outcomeType: r.status === "WON" ? "success" : "failure"
      }
    });
  }
  return out;
}

async function searchCampaignOutcomes(orgId: string, tokens: string[], input: RetrievalInput, since: Date): Promise<Precedent[]> {
  const where: any = { orgId, createdAt: { gte: since } };
  if (input.clientId) where.clientId = input.clientId;

  const rows = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { client: { select: { businessName: true } } }
  });
  const out: Precedent[] = [];
  for (const r of rows) {
    const text = `${r.name} ${r.platform} ${r.objective ?? ""} ${r.notes ?? ""}`;
    const s = score(tokens, text);
    if (s < 0.2) continue;
    const cpl = Number(r.leads) > 0 ? r.spent / Number(r.leads) : 0;
    const roas = r.spent > 0 ? r.revenue / r.spent : 0;
    out.push({
      kind: "campaign_outcome",
      id: r.id,
      title: `${r.name} (${r.platform}) — ${r.status}`,
      summary: `${r.objective ?? ""}`,
      context: `Spend ₹${r.spent.toLocaleString("en-IN")}, ${Number(r.leads)} leads, ${r.status}`,
      outcome: `CPL ₹${cpl.toFixed(0)}, ROAS ${roas.toFixed(2)}×`,
      similarity: s,
      when: r.createdAt,
      refs: {
        clientId: r.clientId ?? undefined,
        clientName: r.client?.businessName,
        outcomeType: r.status === "ACTIVE" ? "neutral" : r.status === "PAUSED" ? "failure" : "neutral"
      }
    });
  }
  return out;
}
