// Adziga — CampaignAnomalyService (Sprint 9b)
// Detects anomalies in active campaigns and surfaces an auto-pause
// recommendation. Uses the rolling Z-score from lib/analytics/anomaly-detection
// but wraps it with campaign-specific metric rollup + severity heuristics
// tuned for "should we pause this campaign?".
//
// Three metrics per campaign:
//   • CPL — cost per lead. Spikes → consider pausing (most actionable).
//   • Spend — actual spend vs budget. Spikes → budget overrun risk.
//   • Leads — volume. Drops → campaign may have stopped delivering.
//
// The service is read-only. Returns a `CampaignAnomaly[]` list ordered by
// severity, each entry includes a `recommendAction` of either "pause",
// "watch", or "scale".

import { prisma } from "@/lib/db";
import { detectAnomalies } from "@/lib/analytics/anomaly-detection";

export type Recommendation = "pause" | "watch" | "scale" | "none";

export type CampaignAnomaly = {
  campaignId: string;
  campaignName: string;
  platform: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  budget: number | null;
  spent: number;
  budgetPct: number;
  industry: string | null;
  /** Industry-benchmark CPL ceiling (cplMax) for (industry, platform). Null when no row. */
  industryCplMax: number | null;
  /** True if observed CPL exceeds 80% of the industry ceiling — strong auto-pause signal regardless of Z-score. */
  exceedsIndustryCeiling: boolean;
  metrics: Array<{
    metric: "cpl" | "spend" | "leads";
    severity: "info" | "warning" | "critical";
    zScore: number;
    observed: number;
    baseline: number;
    deltaPct: number;
    direction: "spike" | "drop";
    suggestedAction: string;
  }>;
  /** Best single recommendation across all metric anomalies */
  recommendAction: Recommendation;
  /** Why this recommendation — short human-readable reason */
  reason: string;
  /** True if the campaign has been active ≥ 7 days (filters out startup noise) */
  hasEnoughHistory: boolean;
};

export const CampaignAnomalyService = {
  /**
   * Detect anomalies across all active campaigns in the org.
   */
  async detectForOrg(orgId: string, days: number = 30): Promise<CampaignAnomaly[]> {
    const since = new Date(Date.now() - days * 86_400_000);

    // Sprint 12d — load per-org anomaly overrides from Organization.metadata.
    // Admins can tune threshold (default 2.5σ) and the industry-ceiling
    // multiplier (default 0.8 = pause when CPL > 80% of cplMax).
    const orgRow = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    let sigmaThreshold = 2.5;
    let industryCeilingMultiplier = 0.8;
    if (orgRow?.metadata) {
      try {
        const meta = JSON.parse(orgRow.metadata) as Record<string, unknown>;
        const ov = meta.anomalyOverrides as { sigmaThreshold?: number; industryCeilingMultiplier?: number } | undefined;
        if (ov?.sigmaThreshold) sigmaThreshold = Math.max(1, Math.min(5, Number(ov.sigmaThreshold)));
        if (ov?.industryCeilingMultiplier) industryCeilingMultiplier = Math.max(0.1, Math.min(2, Number(ov.industryCeilingMultiplier)));
      } catch {
        // malformed metadata — ignore
      }
    }

    // 1. Get all active campaigns (anything with status=ACTIVE).
    const campaigns = await prisma.campaign.findMany({
      where: { orgId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: { client: { select: { id: true, businessName: true, industry: true } } },
      orderBy: { updatedAt: "desc" }
    });

    if (campaigns.length === 0) return [];

    // 1b. Industry benchmark lookup so we can tighten or relax thresholds per (industry, channel).
    // Default threshold is 2.5σ; if the observed CPL exceeds industry-benchmark cplMax * 0.8
    // we treat it as "auto-pause" regardless of Z-score.
    const industrySlugs = Array.from(
      new Set(
        campaigns
          .map((c) => c.client?.industry ?? "")
          .filter(Boolean) as string[]
      )
    );
    const benchmarkRows = industrySlugs.length > 0
      ? await prisma.industryBenchmark.findMany({
          where: { industry: { in: industrySlugs }, region: "IN", objective: "lead_generation" }
        })
      : [];
    const benchByKey = new Map<string, { cplMax: number; cplMedian: number; industry: string }>();
    for (const b of benchmarkRows) {
      benchByKey.set(`${b.industry}:${b.channel}`, {
        cplMax: b.cplMax,
        cplMedian: b.cplMedian,
        industry: b.industry
      });
    }

    const out: CampaignAnomaly[] = [];

    for (const c of campaigns) {
      // 2. Pull per-day metrics for the campaign. AdSpend has daily granularity
      // for amount, but leads/clicks are aggregated on the Campaign row — we
      // synthesize a daily series from the running totals so the Z-score
      // detector has something to work with. Once the ad-platform sync ships
      // we'll switch to per-day leads/clicks from the API.
      const adSpend = await prisma.adSpend.findMany({
        where: { campaignId: c.id, date: { gte: since } },
        orderBy: { date: "asc" }
      });

      let dailySeries: { date: string; spend: number; leads: number; impressions: number; clicks: number }[];

      const spendByDay = new Map<string, number>();
      for (const a of adSpend) {
        const k = a.date.toISOString().slice(0, 10);
        spendByDay.set(k, (spendByDay.get(k) ?? 0) + a.amount);
      }

      // Build a daily series. Use real AdSpend for amount when available;
      // distribute running leads/clicks/impressions evenly across days as
      // a placeholder until the API sync provides daily granularity.
      const runningLeads = Number(c.leads);
      const runningClicks = Number(c.clicks);
      const runningImp = Number(c.impressions);
      const perDayLeads = runningLeads / Math.max(days, 1);
      const perDayClicks = runningClicks / Math.max(days, 1);
      const perDayImp = runningImp / Math.max(days, 1);

      dailySeries = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000);
        const k = d.toISOString().slice(0, 10);
        dailySeries.push({
          date: k,
          spend: spendByDay.get(k) ?? 0,
          leads: perDayLeads,
          impressions: perDayImp,
          clicks: perDayClicks
        });
      }

      const hasRealSpendData = adSpend.length >= 5;

      // 3. For each metric, build a series and detect anomalies.
      const metricFindings: CampaignAnomaly["metrics"] = [];
      for (const metric of ["cpl", "spend", "leads"] as const) {
        const series = dailySeries.map((d) => ({
          date: d.date,
          value: metricValue(d, metric)
        }));
        const result = detectAnomalies({ metric, series, threshold: sigmaThreshold, direction: "both" });
        for (const a of result.anomalies) {
          metricFindings.push({
            metric,
            severity: a.severity,
            zScore: a.zScore,
            observed: a.observed,
            baseline: a.expected,
            deltaPct: a.observed > 0 && a.expected > 0 ? ((a.observed - a.expected) / a.expected) * 100 : 0,
            direction: a.zScore > 0 ? "spike" : "drop",
            suggestedAction: a.suggestedAction
          });
        }
      }

      if (metricFindings.length === 0) {
        // Industry-benchmark ceiling check applies even when no rolling-window anomaly.
        const industry = c.client?.industry ?? null;
        const bench = industry ? benchByKey.get(`${industry}:${c.platform}`) ?? null : null;
        const industryCplMax = bench?.cplMax ?? null;
        const totalSpendHist = dailySeries.reduce((s, d) => s + d.spend, 0);
        const totalLeadsHist = dailySeries.reduce((s, d) => s + d.leads, 0);
        const histCpl = totalLeadsHist > 0 ? totalSpendHist / totalLeadsHist : 0;
        const histExceeds = industryCplMax !== null && histCpl > industryCplMax * industryCeilingMultiplier;
        out.push({
          campaignId: c.id,
          campaignName: c.name,
          platform: c.platform,
          clientId: c.client?.id ?? null,
          clientName: c.client?.businessName ?? null,
          status: c.status,
          budget: c.budget,
          spent: c.spent,
          budgetPct: c.budget && c.budget > 0 ? (c.spent / c.budget) * 100 : 0,
          industry,
          industryCplMax,
          exceedsIndustryCeiling: histExceeds,
          metrics: [],
          recommendAction: histExceeds ? "pause" : "none",
          reason: histExceeds
            ? `CPL ₹${histCpl.toFixed(0)} exceeds ${(industryCeilingMultiplier * 100).toFixed(0)}% of industry ceiling ₹${industryCplMax?.toFixed(0)} for ${industry}/${c.platform}. Pause recommended (rolling window OK; industry-relative check triggered).`
            : (hasRealSpendData
                ? "No anomalies detected in the last window."
                : "Insufficient spend history (need ≥5 daily AdSpend rows). Connect ad-platform sync for anomaly detection."),
          hasEnoughHistory: hasRealSpendData
        });
        continue;
      }

      // 4. Determine overall recommendation. CPL spikes are the most actionable.
      const cplSpike = metricFindings.find((f) => f.metric === "cpl" && f.direction === "spike" && (f.severity === "warning" || f.severity === "critical"));
      const leadsDrop = metricFindings.find((f) => f.metric === "leads" && f.direction === "drop" && (f.severity === "warning" || f.severity === "critical"));
      const spendSpike = metricFindings.find((f) => f.metric === "spend" && f.direction === "spike" && f.severity === "critical");
      const cplDrop = metricFindings.find((f) => f.metric === "cpl" && f.direction === "drop" && f.severity === "warning" || f.severity === "critical");

      // Industry-benchmark ceiling check. If we have a benchmark row for
      // (industry, channel) and the current CPL exceeds 80% of cplMax,
      // this is an industry-relative anomaly worth surfacing even if the
      // Z-score stays below threshold (campaigns that have always been
      // inefficient don't show up in rolling baselines).
      const industry = c.client?.industry ?? null;
      const bench = industry ? benchByKey.get(`${industry}:${c.platform}`) ?? null : null;
      const industryCplMax = bench?.cplMax ?? null;
      const latestCpl = metricFindings.find((f) => f.metric === "cpl")?.observed ?? null;
      const exceedsIndustryCeiling = industryCplMax !== null && latestCpl !== null && latestCpl > industryCplMax * industryCeilingMultiplier;

      let recommendAction: Recommendation = "watch";
      let reason = "Anomalies detected but within watch thresholds.";
      if (exceedsIndustryCeiling) {
        recommendAction = "pause";
        reason = `CPL ₹${latestCpl?.toFixed(0)} exceeds ${(industryCeilingMultiplier * 100).toFixed(0)}% of industry ceiling ₹${industryCplMax?.toFixed(0)} for ${industry}/${c.platform}. Pause recommended regardless of Z-score.`;
      } else if (cplSpike && cplSpike.severity === "critical") {
        recommendAction = "pause";
        reason = `CPL is ${cplSpike.deltaPct.toFixed(0)}% above baseline (z=${cplSpike.zScore.toFixed(1)}). Critical spike — recommend pausing and reviewing creative.`;
      } else if (cplSpike) {
        recommendAction = "watch";
        reason = `CPL trending ${cplSpike.deltaPct.toFixed(0)}% above baseline (z=${cplSpike.zScore.toFixed(1)}). Watch for 24h before pausing.`;
      } else if (leadsDrop && leadsDrop.severity === "critical") {
        recommendAction = "watch";
        reason = `Lead volume down ${Math.abs(leadsDrop.deltaPct).toFixed(0)}% (z=${leadsDrop.zScore.toFixed(1)}). Investigate channel.`;
      } else if (cplDrop && cplDrop.severity !== "info") {
        recommendAction = "scale";
        reason = `CPL down ${Math.abs(cplDrop.deltaPct).toFixed(0)}% — efficient period. Consider scaling budget.`;
      } else if (spendSpike) {
        recommendAction = "watch";
        reason = `Spend up ${spendSpike.deltaPct.toFixed(0)}% (z=${spendSpike.zScore.toFixed(1)}). May indicate runaway budget pacing.`;
      }

      out.push({
        campaignId: c.id,
        campaignName: c.name,
        platform: c.platform,
        clientId: c.client?.id ?? null,
        clientName: c.client?.businessName ?? null,
        status: c.status,
        budget: c.budget,
        spent: c.spent,
        budgetPct: c.budget && c.budget > 0 ? (c.spent / c.budget) * 100 : 0,
        industry,
        industryCplMax,
        exceedsIndustryCeiling,
        metrics: metricFindings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)),
        recommendAction,
        reason,
        hasEnoughHistory: hasRealSpendData
      });
    }

    // Sort: pause candidates first, then watch, then scale, then none.
    return out.sort((a, b) => priorityWeight(a.recommendAction) - priorityWeight(b.recommendAction));
  },

  /**
   * Convenience: only the campaigns we should consider pausing.
   * Used by the AutoApprove policy evaluator for the prebuilt
   * "pause-underperformers" template.
   */
  async pauseCandidates(orgId: string, days: number = 30): Promise<CampaignAnomaly[]> {
    const all = await this.detectForOrg(orgId, days);
    return all.filter((a) => a.recommendAction === "pause");
  }
};

function severityWeight(s: string): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

function priorityWeight(r: Recommendation): number {
  if (r === "pause") return 0;
  if (r === "watch") return 1;
  if (r === "scale") return 2;
  return 3;
}

function metricValue(d: { spend: number; leads: number; impressions: number; clicks: number }, m: "cpl" | "spend" | "leads"): number {
  if (m === "cpl") return d.leads > 0 ? d.spend / d.leads : 0;
  if (m === "spend") return d.spend;
  return d.leads;
}
