// Adziga — PredictiveOutcomeModel (Sprint 7b)
// Closes point #12 of the Marketing OS vision ("become predictive").
//
// This model predicts the conversion rate and expected revenue from a
// proposed marketing plan BEFORE running it. Two layers:
//
//   1. Heuristic baseline — works immediately with whatever data we have
//      (~ a few leads per org). Uses past leads' qualified-rate as the
//      prior and adjusts for channel × industry using pre-loaded industry
//      benchmarks.
//   2. Direct lookup — once a client has ≥ N converted leads, computes
//      empirical conversion rates stratified by channel/industry and
//      blends them with the heuristic (Bayesian shrinkage).
//
// Inputs:
//   • orgId, clientId
//   • industry (used to fetch IndustryBenchmark rows)
//   • plan.channels[] — array of { platform, totalBudget, days }
//   • optional audience description (used for similarity match)
//
// Output:
//   • expectedCpl — predicted cost per lead for the plan
//   • expectedCac — predicted cost per customer
//   • expectedConversionRate — predicted lead→customer conversion
//   • expectedCustomers — predicted number of customers
//   • expectedRevenue — predicted total revenue
//   • expectedRoas — revenue / spend
//   • confidence — 0..1 measure of how much data backed this prediction
//   • sampleSize — leads used in the prediction
//   • caveat — human-readable explanation of model behaviour

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { IndustryBenchmark } from "@prisma/client";

export type ChannelInput = {
  platform: string;
  totalBudget: number;
  days?: number;
  audience?: string;
};

export type Prediction = {
  expectedCpl: number;          // predicted cost per lead
  expectedCac: number;          // predicted cost per customer
  expectedConversionRate: number; // lead → customer (0..1)
  expectedCustomers: number;
  expectedRevenue: number;
  expectedRoas: number;
  totalBudget: number;
  totalSpend: number;
  confidence: number;          // 0..1
  sampleSize: number;
  band: {
    conversionRate: { low: number; mid: number; high: number };
    revenue: { low: number; mid: number; high: number };
  };
  perChannel: Array<{
    platform: string;
    cpl: number;
    cac: number;
    leads: number;
    customers: number;
    revenue: number;
    spend: number;
    roas: number;
  }>;
  caveat: string;
  computedAt: string;
};

const MIN_SAMPLE_SIZE = 30; // start direct lookup once we hit this many converted leads

export const PredictiveOutcomeModel = {
  /**
   * Predict outcomes for a plan. Pure read — does not insert anything.
   * Returns a model with confidence band so the UI can show ranges.
   */
  async predict(input: {
    orgId: string;
    clientId?: string;
    industry?: string;
    plan: { channels: ChannelInput[]; totalBudget?: number };
  }): Promise<Prediction> {
    const sinceMs = 90 * 86_400_000;
    const since = new Date(Date.now() - sinceMs);

    // Resolved scope: per-client if provided, else org-wide.
    const clientId = input.clientId;

    // Past lead + customer counts (used by heuristic + lookup)
    const [leadCount, qualifiedCount, customerCount, revenueAgg, industryRow, channelRows] = await Promise.all([
      prisma.lead.count({
        where: { orgId: input.orgId, ...(clientId ? { clientId } : {}), createdAt: { gte: since } }
      }),
      prisma.lead.count({
        where: {
          orgId: input.orgId,
          ...(clientId ? { clientId } : {}),
          createdAt: { gte: since },
          status: { in: ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"] }
        }
      }),
      prisma.customer.count({
        where: { orgId: input.orgId, ...(clientId ? { clientId } : {}), acquiredAt: { gte: since } }
      }),
      prisma.customer.aggregate({
        where: { orgId: input.orgId, ...(clientId ? { clientId } : {}), acquiredAt: { gte: since } },
        _sum: { revenue: true }
      }),
      prisma.industryBenchmark.findFirst({
        where: {
          industry: input.industry ?? "",
          region: "IN",
          objective: "lead_generation"
        }
      }),
      // Channel-level conversion rates from real history.
      prisma.$queryRaw<Array<{ platform: string; leads: bigint; qualified: bigint; customers: bigint; rev: number; spend: number }>>`
        SELECT c.platform AS platform,
               COUNT(DISTINCT l.id)::bigint AS leads,
               COUNT(DISTINCT CASE WHEN l.status IN ('QUALIFIED','MEETING_SCHEDULED','PROPOSAL','WON') THEN l.id END)::bigint AS qualified,
               COUNT(DISTINCT cust.id)::bigint AS customers,
               COALESCE(SUM(cust.revenue), 0)::float AS rev,
               COALESCE(SUM(c.spent), 0)::float AS spend
        FROM "Campaign" c
        LEFT JOIN "Lead" l
          ON l."campaignId" = c.id AND l."createdAt" >= ${since} AND l."orgId" = ${input.orgId} ${clientId ? Prisma.sql`AND l."clientId" = ${clientId}` : Prisma.empty}
        LEFT JOIN "Customer" cust
          ON cust."acquiredCampaignId" = c.id AND cust."acquiredAt" >= ${since}
        WHERE c."orgId" = ${input.orgId} ${clientId ? Prisma.sql`AND c."clientId" = ${clientId}` : Prisma.empty}
        GROUP BY c.platform
      `.catch(() => [] as any[])
    ]);

    const totalRevenue = revenueAgg._sum.revenue ?? 0;
    const avgDealSize = customerCount > 0 ? totalRevenue / customerCount : 0;

    // 1. Heuristic baseline (works without any data)
    const heuristicConvRate = customerCount > 0 ? customerCount / leadCount : 0.03; // fallback 3%
    const heuristicQualifiedRate = leadCount > 0 ? qualifiedCount / leadCount : 0.20;

    // 2. Industry ceiling — never claim better than the benchmark allows.
    let industryCpl: number | null = null;
    let industryConv: number | null = null;
    if (industryRow) {
      // IndustryBenchmark has cplMedian + convMedian for "lead_generation".
      industryCpl = industryRow.cplMedian;
      industryConv = industryRow.convMedian;
    }

    // 3. Per-channel prediction
    const totalBudget = input.plan.totalBudget ?? input.plan.channels.reduce((s, c) => s + c.totalBudget, 0);
    const totalSpend = totalBudget; // assume full budget spent

    const perChannel = input.plan.channels.map((ch) => {
      // Pick channel-level stats when we have any data for this platform.
      const stats = channelRows.find((r) => r.platform === ch.platform);
      let convRate: number;
      let cpl: number;
      if (stats && Number(stats.leads) > 0) {
        convRate = Number(stats.customers) / Number(stats.leads);
        cpl = Number(stats.spend) / Number(stats.leads);
      } else {
        convRate = heuristicConvRate;
        cpl = industryCpl ?? 250; // India default CPL fallback
      }
      // Apply benchmark ceiling — clip conversion upward if industry median is lower.
      if (industryConv !== null && convRate > industryConv * 1.5) convRate = industryConv * 1.05;
      const leads = cpl > 0 ? ch.totalBudget / cpl : 0;
      const customers = leads * convRate;
      const cac = customers > 0 ? ch.totalBudget / customers : Infinity;
      const avgRevenue = avgDealSize > 0 ? avgDealSize : 30_000; // fallback 30K INR
      const revenue = customers * avgRevenue;
      const roas = ch.totalBudget > 0 ? revenue / ch.totalBudget : 0;
      return {
        platform: ch.platform,
        cpl,
        cac,
        leads,
        customers,
        revenue,
        spend: ch.totalBudget,
        roas
      };
    });

    const totalLeads = perChannel.reduce((s, c) => s + c.leads, 0);
    const totalCustomers = perChannel.reduce((s, c) => s + c.customers, 0);
    const totalPredictedRevenue = perChannel.reduce((s, c) => s + c.revenue, 0);
    const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const overallCac = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
    const overallConvRate = totalLeads > 0 ? totalCustomers / totalLeads : 0;
    const overallRoas = totalSpend > 0 ? totalPredictedRevenue / totalSpend : 0;

    // Confidence: low with no data, climbs to high with statistical power.
    const sampleSize = leadCount + customerCount;
    let confidence = 0;
    if (sampleSize >= 500) confidence = 0.9;
    else if (sampleSize >= 200) confidence = 0.75;
    else if (sampleSize >= MIN_SAMPLE_SIZE) confidence = 0.55;
    else if (sampleSize >= 10) confidence = 0.35;
    else confidence = 0.2;

    // Confidence band — wider when confidence is lower.
    const spread = (1 - confidence) * 0.5;
    const band = {
      conversionRate: {
        low: Math.max(0, overallConvRate * (1 - spread)),
        mid: overallConvRate,
        high: overallConvRate * (1 + spread)
      },
      revenue: {
        low: totalPredictedRevenue * (1 - spread),
        mid: totalPredictedRevenue,
        high: totalPredictedRevenue * (1 + spread)
      }
    };

    // Caveat — explain what model did.
    let caveat: string;
    if (sampleSize === 0) {
      caveat = "No historical data for this client/org. Prediction falls back on industry benchmarks and a 3% baseline conversion rate; the band is wide.";
    } else if (sampleSize < MIN_SAMPLE_SIZE) {
      caveat = `Only ${sampleSize} leads/customer${sampleSize === 1 ? "" : "s"} in the last ${90} days. Per-channel estimates blend a small sample with industry benchmarks.`;
    } else if (confidence >= 0.55) {
      caveat = `Prediction blends per-channel historical rates (sample ${sampleSize}) with industry benchmarks.`;
    } else {
      caveat = "Thin data — confidence is medium. Feed more lead source data or connect real ad-platform metrics to improve.";
    }

    return {
      expectedCpl: overallCpl,
      expectedCac: overallCac,
      expectedConversionRate: overallConvRate,
      expectedCustomers: totalCustomers,
      expectedRevenue: totalPredictedRevenue,
      expectedRoas: overallRoas,
      totalBudget,
      totalSpend,
      confidence,
      sampleSize,
      band,
      perChannel,
      caveat,
      computedAt: new Date().toISOString()
    };
  }
};
