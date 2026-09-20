// Adziga — Analytics Index
// Public API for the deep analytics layer.

export * from "./types";
export { fitMMM } from "./mmm";
export { computeAttribution, computeAttributionBatch } from "./attribution";
export {
  defaultModel,
  scoreLead,
  scoreLeads,
  updateModel,
  trainModel,
  featurize,
  FEATURE_DIM
} from "./lead-scoring";
export { optimizeBudget, updateArm } from "./budget-optimization";
export { detectAnomalies, detectAllAnomalies } from "./anomaly-detection";

import { prisma } from "@/lib/db";
import type { Channel } from "./types";
import { fitMMM } from "./mmm";
import { defaultModel, scoreLeads, trainModel, featurize } from "./lead-scoring";
import { optimizeBudget } from "./budget-optimization";
import { detectAnomalies } from "./anomaly-detection";

// ─── High-level orchestration ───────────────────────────────────────────────
// Pulls real data from Postgres, runs the models, returns insights.

/**
 * Run Marketing Mix Modeling on the last 90 days of campaign spend
 * and the customer revenue tied to that period.
 */
export async function runMMMForOrg(orgId: string, days: number = 90) {
  const since = new Date(Date.now() - days * 86400_000);

  // Pull ad spend + linked campaign platforms (campaignId is a scalar — no relation).
  const adSpends = await prisma.adSpend.findMany({
    where: { orgId, date: { gte: since } },
    select: { date: true, amount: true, campaignId: true }
  });

  const campaignIds = Array.from(
    new Set(adSpends.map((s) => s.campaignId).filter((id): id is string => Boolean(id)))
  );
  const campaigns = campaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, platform: true }
      })
    : [];
  const campaignPlatform = new Map(campaigns.map((c) => [c.id, c.platform]));

  const channelMap: Record<string, string> = {
    META: "META",
    FACEBOOK: "META",
    INSTAGRAM: "META",
    GOOGLE: "GOOGLE",
    GOOGLE_ADS: "GOOGLE",
    EMAIL: "EMAIL",
    WHATSAPP: "WHATSAPP",
    ORGANIC: "ORGANIC",
    DIRECT: "DIRECT",
    REFERRAL: "REFERRAL",
    OTHER: "OTHER"
  };

  const datapoints = adSpends.map((s) => {
    const platform = s.campaignId ? campaignPlatform.get(s.campaignId) ?? "OTHER" : "OTHER";
    return {
      date: s.date.toISOString().slice(0, 10),
      channel: (channelMap[platform] ?? "OTHER") as Channel,
      spend: s.amount
    };
  });

  // Aggregate revenue by date (from Customer.acquiredAt + revenue)
  const customers = await prisma.customer.findMany({
    where: { orgId, acquiredAt: { gte: since } },
    select: { acquiredAt: true, revenue: true }
  });
  const revenueByDate: Record<string, number> = {};
  for (const c of customers) {
    const d = c.acquiredAt.toISOString().slice(0, 10);
    revenueByDate[d] = (revenueByDate[d] ?? 0) + c.revenue;
  }

  return fitMMM(datapoints, revenueByDate);
}

/**
 * Score all recent leads in an organization using the predictive model.
 * Cold-start: trains on historical conversions if no model saved.
 */
export async function scoreAllLeadsForOrg(orgId: string, limit: number = 100) {
  const recentLeads = await prisma.lead.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      source: true,
      createdAt: true,
      status: true,
      score: true,
      phone: true,
      name: true,
      email: true,
      city: true
    }
  });

  // Build features (real data may be sparse — use available fields, default others)
  const features = recentLeads.map((lead) => {
    const daysSinceCreated = Math.max(0, (Date.now() - lead.createdAt.getTime()) / 86400_000);
    return {
      leadId: lead.id,
      source: (lead.source || "OTHER") as Channel,
      daysSinceCreated,
      emailOpens: 0, // not tracked yet — pluggable
      emailClicks: 0,
      websiteVisits: 0,
      formSubmissions: 0,
      hasPhone: (lead.phone ? 1 : 0) as 0 | 1,
      hasCompany: (lead.name ? 1 : 0) as 0 | 1, // presence of name = filled form
      cityTier: 1 as 0 | 1 | 2, // default to tier 2 (unknown)
      previousEngagementScore: lead.score ?? 50,
      recencyDays: Math.min(daysSinceCreated, 30),
      frequency: 1
    };
  });

  // Cold-start: build a tiny training set from the org's own outcomes
  const historicalLeads = await prisma.lead.findMany({
    where: { orgId, status: { in: ["WON", "LOST"] } },
    take: 200,
    select: { source: true, createdAt: true, status: true, score: true, phone: true, name: true }
  });

  const trainingSet = historicalLeads.map((lead) => {
    const daysSinceCreated = Math.max(0, (Date.now() - lead.createdAt.getTime()) / 86400_000);
    return {
      features: {
        source: (lead.source || "OTHER") as Channel,
        daysSinceCreated,
        emailOpens: 0,
        emailClicks: 0,
        websiteVisits: 0,
        formSubmissions: 0,
        hasPhone: (lead.phone ? 1 : 0) as 0 | 1,
        hasCompany: (lead.name ? 1 : 0) as 0 | 1,
        cityTier: 1 as 0 | 1 | 2,
        previousEngagementScore: lead.score ?? 50,
        recencyDays: Math.min(daysSinceCreated, 30),
        frequency: 1
      },
      label: (lead.status === "WON" ? 1 : 0) as 0 | 1
    };
  });

  const model = trainingSet.length >= 10
    ? trainModel(trainingSet, 20)
    : defaultModel();

  return scoreLeads(model, features);
}

/**
 * Recommend optimal budget allocation across channels using Thompson sampling.
 * Uses last-30-day conversion data per channel as arm evidence.
 */
export async function optimizeBudgetForOrg(orgId: string, totalBudget: number, days: number = 30) {
  const since = new Date(Date.now() - days * 86400_000);

  const leads = await prisma.lead.findMany({
    where: { orgId, createdAt: { gte: since } },
    select: { source: true, status: true }
  });

  const channelStats = new Map<string, { successes: number; failures: number; spend: number; revenue: number }>();
  for (const lead of leads) {
    const ch = lead.source || "OTHER";
    if (!channelStats.has(ch)) channelStats.set(ch, { successes: 0, failures: 0, spend: 0, revenue: 0 });
    const s = channelStats.get(ch)!;
    if (lead.status === "WON") s.successes++;
    else if (lead.status === "LOST") s.failures++;
  }

  // Get spend per channel
  const adSpends = await prisma.adSpend.findMany({
    where: { orgId, date: { gte: since } },
    select: { amount: true, campaignId: true }
  });
  const spendCampaignIds = Array.from(
    new Set(adSpends.map((s) => s.campaignId).filter((id): id is string => Boolean(id)))
  );
  const spendCampaigns = spendCampaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: spendCampaignIds } },
        select: { id: true, platform: true }
      })
    : [];
  const spendCampaignPlatform = new Map(spendCampaigns.map((c) => [c.id, c.platform]));
  for (const s of adSpends) {
    const platform = s.campaignId ? spendCampaignPlatform.get(s.campaignId) ?? "OTHER" : "OTHER";
    if (!channelStats.has(platform)) channelStats.set(platform, { successes: 0, failures: 0, spend: 0, revenue: 0 });
    channelStats.get(platform)!.spend += s.amount;
  }

  const arms = Array.from(channelStats.entries()).map(([channel, s]) => ({
    channel: channel as Channel,
    successes: s.successes,
    failures: s.failures,
    spend: s.spend,
    revenue: 0
  }));

  // If no data yet, allocate evenly
  if (arms.length === 0 || arms.every((a) => a.successes + a.failures === 0)) {
    return optimizeBudget({
      totalBudget,
      arms: (["META", "GOOGLE", "EMAIL", "WHATSAPP", "ORGANIC", "DIRECT", "REFERRAL", "OTHER"] as Channel[]).map((c) => ({
        channel: c,
        successes: 1,
        failures: 1,
        spend: totalBudget / 8,
        revenue: 0
      }))
    });
  }

  return optimizeBudget({ totalBudget, arms });
}

/**
 * Run anomaly detection on the standard marketing metrics for an org.
 */
export async function detectOrgAnomalies(orgId: string, days: number = 30) {
  const since = new Date(Date.now() - days * 86400_000);

  // Build daily series for: spend, leads, CPL, ROAS, CTR
  const series: Record<string, Array<{ date: string; value: number }>> = {
    spend: [],
    leads: [],
    cpl: [],
    roas: [],
    ctr: []
  };

  const adSpends = await prisma.adSpend.findMany({
    where: { orgId, date: { gte: since } },
    select: { date: true, amount: true, campaignId: true }
  });
  const anomalyCampaignIds = Array.from(
    new Set(adSpends.map((s) => s.campaignId).filter((id): id is string => Boolean(id)))
  );
  const anomalyCampaigns = anomalyCampaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: anomalyCampaignIds } },
        select: { id: true, clicks: true, impressions: true }
      })
    : [];
  const campaignClicksImpressions = new Map(
    anomalyCampaigns.map((c) => [c.id, { clicks: Number(c.clicks), impressions: Number(c.impressions) }])
  );

  const spendByDate = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const s of adSpends) {
    const d = s.date.toISOString().slice(0, 10);
    if (!spendByDate.has(d)) spendByDate.set(d, { spend: 0, clicks: 0, impressions: 0 });
    const e = spendByDate.get(d)!;
    e.spend += s.amount;
    const ci = s.campaignId ? campaignClicksImpressions.get(s.campaignId) : undefined;
    if (ci) {
      e.clicks += ci.clicks;
      e.impressions += ci.impressions;
    }
  }

  const leadsByDate = new Map<string, number>();
  const leads = await prisma.lead.findMany({
    where: { orgId, createdAt: { gte: since } },
    select: { createdAt: true }
  });
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    leadsByDate.set(d, (leadsByDate.get(d) ?? 0) + 1);
  }

  const revenueByDate = new Map<string, number>();
  const customers = await prisma.customer.findMany({
    where: { orgId, acquiredAt: { gte: since } },
    select: { acquiredAt: true, revenue: true }
  });
  for (const c of customers) {
    const d = c.acquiredAt.toISOString().slice(0, 10);
    revenueByDate.set(d, (revenueByDate.get(d) ?? 0) + c.revenue);
  }

  // Generate date list
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  }

  for (const d of dates) {
    const s = spendByDate.get(d) ?? { spend: 0, clicks: 0, impressions: 0 };
    const leadsCount = leadsByDate.get(d) ?? 0;
    const revenue = revenueByDate.get(d) ?? 0;
    series.spend.push({ date: d, value: s.spend });
    series.leads.push({ date: d, value: leadsCount });
    series.cpl.push({ date: d, value: leadsCount > 0 ? s.spend / leadsCount : 0 });
    series.roas.push({ date: d, value: s.spend > 0 ? revenue / s.spend : 0 });
    series.ctr.push({ date: d, value: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0 });
  }

  const results: Record<string, ReturnType<typeof detectAnomalies>> = {};
  for (const [metric, data] of Object.entries(series)) {
    results[metric] = detectAnomalies({ metric, series: data });
  }
  return results;
}
