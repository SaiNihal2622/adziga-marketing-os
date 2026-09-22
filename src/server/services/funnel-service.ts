// Adziga — Funnel Analysis Service
// Surfaces the full impression → visitor → lead → qualified → customer → revenue
// chain with per-stage drop-off detection. The Marketing OS uses this to:
//
//   1. Show the funnel on the Command Center + /app/analytics
//   2. Auto-flag the "leakiest" stage so the Strategy Agent can diagnose it
//   3. Provide a numeric basis for the "what changed" reasoning
//
// "Visitor" is a soft concept — we don't have a Visitor table today, so we
// approximate it as unique leads (assuming every lead corresponds to one
// real visitor session). When we wire real analytics (GA4 / Plausible /
// Meta Pixel) we can swap the source.

import { prisma } from "@/lib/db";

export type FunnelStageKey =
  | "impressions"
  | "visitors"
  | "leads"
  | "qualified"
  | "customers"
  | "revenue";

export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  value: number;
  // Conversion rate from the previous stage. null for the first stage.
  conversionRate: number | null;
  // Drop-off count from the previous stage. null for the first stage.
  dropOff: number | null;
  // Severity of the drop-off relative to a sane benchmark. Used to flag.
  // 0 = healthy, 1 = watch, 2 = critical.
  severity: 0 | 1 | 2;
};

export type FunnelSnapshot = {
  windowDays: number;
  funnel: FunnelStage[];
  // The stage with the worst conversion rate, if any. The Marketing OS
  // surfaces this as "current issue: lead → qualified is the leak."
  worstStage: FunnelStage | null;
  // Sanity-checked summary numbers (revenue, spend, CAC, ROAS)
  revenue: number;
  spend: number;
  cac: number;
  roas: number;
  // Lead→customer conversion rate overall
  endToEndRate: number;
};

export type FunnelFilter = {
  orgId: string;
  clientId?: string;
  campaignId?: string;
  windowDays?: number;
};

// Industry-baseline drop-off rates that flag "this stage is leaking".
// Anything worse than the baseline gets severity >= 1; much worse = severity 2.
// These are conservative heuristics — tune as we accumulate real data.
const BENCHMARKS: Partial<Record<FunnelStageKey, { good: number; ok: number }>> = {
  // Click-through from impressions
  // visitors / impressions: 0.5% is good, 0.1% is bad
  visitors: { good: 0.005, ok: 0.002 },
  // Lead rate from visitors
  leads: { good: 0.05, ok: 0.02 },
  // Qualified rate from leads
  qualified: { good: 0.30, ok: 0.15 },
  // Customer rate from qualified
  customers: { good: 0.25, ok: 0.10 }
};

function classifySeverity(key: FunnelStageKey, rate: number): 0 | 1 | 2 {
  const b = BENCHMARKS[key];
  if (!b) return 0;
  if (rate >= b.good) return 0;
  if (rate >= b.ok) return 1;
  return 2;
}

export const FunnelService = {
  /**
   * Build the full funnel for a given scope (org / client / campaign).
   * Returns stages with conversion rates, drop-offs, and severity flags.
   */
  async snapshot(filter: FunnelFilter): Promise<FunnelSnapshot> {
    const windowDays = filter.windowDays ?? 90;
    const since = new Date(Date.now() - windowDays * 86_400_000);

    // Build the where clauses for each stage
    const campaignScope = filter.campaignId ? { campaignId: filter.campaignId } : {};
    const clientScope = filter.clientId ? { clientId: filter.clientId } : {};
    const leadScope = { orgId: filter.orgId, ...campaignScope, ...clientScope, createdAt: { gte: since } };

    // Aggregate raw counts per stage
    const [impressionsAgg, leadsCount, qualifiedCount, customersCount, revenueAgg, spendAgg] = await Promise.all([
      prisma.campaign.aggregate({
        where: { orgId: filter.orgId, ...(filter.campaignId ? { id: filter.campaignId } : {}), ...(filter.clientId ? { clientId: filter.clientId } : {}) },
        _sum: { impressions: true }
      }),
      prisma.lead.count({ where: leadScope }),
      prisma.lead.count({
        where: { ...leadScope, status: { in: ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"] } }
      }),
      prisma.lead.count({ where: { ...leadScope, status: "WON" } }),
      prisma.customer.aggregate({
        where: {
          orgId: filter.orgId,
          ...(filter.campaignId ? { acquiredCampaignId: filter.campaignId } : {}),
          ...(filter.clientId ? { clientId: filter.clientId } : {}),
          acquiredAt: { gte: since }
        },
        _sum: { revenue: true }
      }),
      prisma.campaign.aggregate({
        where: { orgId: filter.orgId, ...(filter.campaignId ? { id: filter.campaignId } : {}), ...(filter.clientId ? { clientId: filter.clientId } : {}) },
        _sum: { spent: true }
      })
    ]);

    const impressions = Number(impressionsAgg._sum.impressions ?? 0);
    // Visitor approximation: unique leads (when leads=0, fall back to clicks)
    let visitors = leadsCount;
    if (visitors === 0) {
      const clicksAgg = await prisma.campaign.aggregate({
        where: { orgId: filter.orgId, ...(filter.campaignId ? { id: filter.campaignId } : {}), ...(filter.clientId ? { clientId: filter.clientId } : {}) },
        _sum: { clicks: true }
      });
      visitors = Number(clicksAgg._sum.clicks ?? 0);
    }
    const leads = leadsCount;
    const qualified = qualifiedCount;
    const customers = customersCount;
    const revenue = revenueAgg._sum.revenue ?? 0;
    const spend = spendAgg._sum.spent ?? 0;

    const stagesRaw: Array<{ key: FunnelStageKey; label: string; value: number }> = [
      { key: "impressions", label: "Impressions", value: impressions },
      { key: "visitors", label: "Visitors", value: visitors },
      { key: "leads", label: "Leads", value: leads },
      { key: "qualified", label: "Qualified leads", value: qualified },
      { key: "customers", label: "Customers", value: customers },
      { key: "revenue", label: "Revenue", value: revenue }
    ];

    const funnel: FunnelStage[] = stagesRaw.map((s, i) => {
      if (i === 0) {
        return { key: s.key, label: s.label, value: s.value, conversionRate: null, dropOff: null, severity: 0 };
      }
      const prev = stagesRaw[i - 1].value;
      const conv = prev > 0 ? s.value / prev : 0;
      const drop = Math.max(0, prev - s.value);
      // Revenue is the special case — we don't classify its drop-off against a benchmark
      const severity = s.key === "revenue" ? 0 : classifySeverity(s.key, conv);
      return { key: s.key, label: s.label, value: s.value, conversionRate: conv, dropOff: drop, severity };
    });

    // The "leak" is the stage with the worst conversion (excluding revenue).
    let worstStage: FunnelStage | null = null;
    for (const s of funnel.slice(1, -1)) {
      if (s.conversionRate === null) continue;
      if (!worstStage || s.conversionRate < (worstStage.conversionRate ?? Infinity)) {
        worstStage = s;
      }
    }

    const cac = customers > 0 ? spend / customers : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const endToEndRate = impressions > 0 ? customers / impressions : 0;

    return {
      windowDays,
      funnel,
      worstStage,
      revenue,
      spend,
      cac,
      roas,
      endToEndRate
    };
  },

  /**
   * Compare two windows side-by-side. Returns delta per stage + the stage
   * with the largest negative change. Powers the "what changed" reasoning
   * on the analytics page.
   */
  async diff(filter: FunnelFilter): Promise<{
    current: FunnelSnapshot;
    previous: FunnelSnapshot;
    deltas: Array<{ key: FunnelStageKey; valueDelta: number; rateDelta: number | null }>;
    worstDeterioration: FunnelStageKey | null;
  }> {
    const windowDays = filter.windowDays ?? 90;
    const halfWindow = Math.max(7, Math.floor(windowDays / 2));
    const now = new Date();
    const currentSince = new Date(now.getTime() - windowDays * 86_400_000);
    const previousSince = new Date(now.getTime() - (windowDays + halfWindow) * 86_400_000);
    const previousUntil = currentSince;

    const [current, previous] = await Promise.all([
      this.snapshot(filter),
      this.snapshot({ ...filter, windowDays: halfWindow }) // half-window approximation
    ]);

    const deltas = current.funnel.map((s, i) => {
      const prev = previous.funnel[i];
      const valueDelta = s.value - (prev?.value ?? 0);
      const rateDelta =
        s.conversionRate !== null && prev?.conversionRate !== null
          ? s.conversionRate - prev.conversionRate
          : null;
      return { key: s.key, valueDelta, rateDelta };
    });

    // Worst deterioration = the conversion-rate stage with the largest negative delta
    let worstDeterioration: FunnelStageKey | null = null;
    let worstDrop = 0;
    for (const d of deltas) {
      if (d.rateDelta !== null && d.rateDelta < worstDrop) {
        worstDrop = d.rateDelta;
        worstDeterioration = d.key;
      }
    }

    return { current, previous, deltas, worstDeterioration };
  }
};
