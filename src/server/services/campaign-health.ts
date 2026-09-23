// Adziga — CampaignHealthService (Sprint 16b)
// Composite "is this campaign OK right now?" score. Each campaign gets a
// 0-100 score derived from five signals, then bucketed into the legacy
// "Healthy" / "At Risk" / "Critical" tier that the campaigns-list UI
// already knows how to render.
//
//   • Spend pacing    — 30 pts max — spent / budget vs. days-elapsed ratio
//   • ROAS vs median  — 25 pts max — campaign ROAS vs org-wide median for same platform
//   • Lead trend      — 20 pts max — recent 7d leads vs prior 7d leads
//   • Anomaly penalty — 15 pts — anomaly detector says pause/watch/none today
//   • CTR floor       — 10 pts — campaign CTR vs platform benchmark floor
//
// The score is recomputed on demand (POST /api/campaigns/health-score-batch)
// and stored in `Campaign.health` so the existing HealthBadge on
// /app/campaigns lights up without any UI work.

import { prisma } from "@/lib/db";
import { CampaignAnomalyService } from "./campaign-anomaly-service";

export type CampaignHealthSignal = {
  key: "pacing" | "roas" | "leadTrend" | "anomaly" | "ctr";
  label: string;
  score: number;        // contribution to total
  max: number;
  detail: string;       // human-readable summary
};

export type CampaignHealthResult = {
  campaignId: string;
  campaignName: string;
  platform: string;
  status: string;
  score: number;        // 0..100
  tier: "Healthy" | "At Risk" | "Critical";
  signals: CampaignHealthSignal[];
  computedAt: string;
};

const PLATFORM_CTR_FLOOR: Record<string, number> = {
  // Conservative floors — under this we call attention to it.
  META: 0.005,
  INSTAGRAM: 0.004,
  GOOGLE: 0.02,
  YOUTUBE: 0.002,
  LINKEDIN: 0.003,
  TWITTER: 0.002,
  WHATSAPP: 0.05,
  EMAIL: 0.01,
  INFLUENCER: 0.005,
  EVENT: 0.01
};

function tierFor(score: number): "Healthy" | "At Risk" | "Critical" {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "At Risk";
  return "Critical";
}

/**
 * Compute the composite health score for one campaign. Pure function over
 * the campaign row + last-30-day signals.
 */
export async function computeCampaignHealth(campaignId: string): Promise<CampaignHealthResult | null> {
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      leadEntries: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500
      }
    }
  });
  if (!c) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);

  // Lead trend — last 7d vs prior 7d
  const recent = c.leadEntries.filter((l) => l.createdAt >= sevenDaysAgo).length;
  const prior = c.leadEntries.filter((l) => l.createdAt >= fourteenDaysAgo && l.createdAt < sevenDaysAgo).length;
  const leadDelta = prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0;

  // CTR
  const ctr = Number(c.impressions) > 0 ? Number(c.clicks) / Number(c.impressions) : 0;
  const ctrFloor = PLATFORM_CTR_FLOOR[c.platform] ?? 0.005;

  // ROAS
  const roas = c.spent > 0 ? c.revenue / c.spent : 0;

  // Median ROAS for the same platform in the org
  const peerRoas = await prisma.campaign.findMany({
    where: { orgId: c.orgId, platform: c.platform, spent: { gt: 0 } },
    select: { spent: true, revenue: true }
  });
  const peerRatios = peerRoas.map((p) => p.revenue / p.spent).sort((a, b) => a - b);
  const medianRoas = peerRatios.length > 0 ? peerRatios[Math.floor(peerRatios.length / 2)] : 0;

  // Pacing — budget vs spend + days elapsed
  let pacingScore = 30;
  let pacingDetail = "No budget set; pacing not scored";
  if (c.budget && c.budget > 0 && c.startDate) {
    const start = c.startDate.getTime();
    const end = c.endDate?.getTime() ?? start + 30 * 86_400_000;
    const nowMs = Date.now();
    const totalSpan = Math.max(1, end - start);
    const elapsed = Math.min(nowMs, end) - start;
    const fractionElapsed = Math.max(0, Math.min(1, elapsed / totalSpan));
    const fractionSpent = c.spent / c.budget;
    // Ideal: fractionSpent ≈ fractionElapsed. Off by too much → lower score.
    const drift = Math.abs(fractionSpent - fractionElapsed);
    if (fractionSpent > 1.05 * fractionElapsed && fractionSpent > 1) pacingScore = 0; // overspent hard
    else if (drift < 0.1) pacingScore = 30;
    else if (drift < 0.25) pacingScore = 22;
    else if (drift < 0.4) pacingScore = 12;
    else pacingScore = 5;
    pacingDetail = `${(fractionSpent * 100).toFixed(0)}% spent, ${(fractionElapsed * 100).toFixed(0)}% elapsed`;
  } else {
    pacingScore = 22;
    pacingDetail = "No budget / start date; partial pacing credit";
  }

  // Lead trend
  let leadScore = 0;
  let leadDetail: string;
  if (prior === 0 && recent === 0) {
    leadScore = 12;  // neutral — not enough data to penalize
    leadDetail = "No leads in last 14d (not enough signal)";
  } else if (prior === 0) {
    leadScore = 18;
    leadDetail = `New: ${recent} leads in last 7d (no prior baseline)`;
  } else {
    if (leadDelta > 0.20) leadScore = 20;
    else if (leadDelta > 0) leadScore = 16;
    else if (leadDelta > -0.20) leadScore = 8;
    else leadScore = 2;
    leadDetail = `${recent} last 7d vs ${prior} prior 7d (${leadDelta >= 0 ? "+" : ""}${(leadDelta * 100).toFixed(0)}%)`;
  }

  // ROAS vs median
  let roasScore = 0;
  let roasDetail: string;
  if (c.spent === 0) {
    roasScore = 15;
    roasDetail = "No spend yet; ROAS neutral";
  } else if (medianRoas === 0) {
    // No peers — fall back to absolute ROAS floor
    if (roas >= 3) roasScore = 25;
    else if (roas >= 2) roasScore = 20;
    else if (roas >= 1) roasScore = 12;
    else roasScore = 4;
    roasDetail = `${roas.toFixed(2)}× ROAS · no peer median yet`;
  } else {
    const ratio = roas / medianRoas;
    if (ratio >= 1.5) roasScore = 25;
    else if (ratio >= 1) roasScore = 20;
    else if (ratio >= 0.7) roasScore = 12;
    else if (ratio >= 0.4) roasScore = 6;
    else roasScore = 0;
    roasDetail = `${roas.toFixed(2)}× vs peer median ${medianRoas.toFixed(2)}×`;
  }

  // CTR
  let ctrScore = 0;
  let ctrDetail: string;
  if (Number(c.impressions) === 0) {
    ctrScore = 6;
    ctrDetail = "No impressions yet";
  } else if (ctr >= ctrFloor * 2) ctrScore = 10;
  else if (ctr >= ctrFloor) ctrScore = 7;
  else if (ctr >= ctrFloor / 2) ctrScore = 3;
  else {
    ctrScore = 0;
  }
  ctrDetail = `${(ctr * 100).toFixed(2)}% (floor ${(ctrFloor * 100).toFixed(2)}%)`;

  // Anomaly penalty — 15 pts
  let anomalyScore = 15;
  let anomalyDetail = "No anomaly detected";
  try {
    const orgAnomalies = await CampaignAnomalyService.detectForOrg(c.orgId, 14);
    const mine = orgAnomalies.find((a) => a.campaignId === c.id);
    if (mine) {
      if (mine.recommendAction === "pause") {
        anomalyScore = 0;
        anomalyDetail = `Anomaly detector says PAUSE — ${mine.reason}`;
      } else if (mine.recommendAction === "watch") {
        anomalyScore = 7;
        anomalyDetail = `Anomaly detector says WATCH — ${mine.reason}`;
      }
    }
  } catch {
    // Anomaly detector can throw on partial data; default to "no anomaly".
  }

  const signals: CampaignHealthSignal[] = [
    { key: "pacing", label: "Spend pacing", score: pacingScore, max: 30, detail: pacingDetail },
    { key: "roas", label: "ROAS vs peers", score: roasScore, max: 25, detail: roasDetail },
    { key: "leadTrend", label: "Lead trend", score: leadScore, max: 20, detail: leadDetail },
    { key: "anomaly", label: "Anomaly detector", score: anomalyScore, max: 15, detail: anomalyDetail },
    { key: "ctr", label: "CTR", score: ctrScore, max: 10, detail: ctrDetail }
  ];

  const totalMax = 100;
  const score = Math.max(0, Math.min(100, Math.round(signals.reduce((s, x) => s + x.score, 0))));

  return {
    campaignId: c.id,
    campaignName: c.name,
    platform: c.platform,
    status: c.status,
    score,
    tier: tierFor(score),
    signals,
    computedAt: new Date().toISOString()
  };
}

/**
 * Compute + persist health for one campaign. Returns null if not found.
 */
export async function recomputeCampaignHealth(campaignId: string): Promise<CampaignHealthResult | null> {
  const result = await computeCampaignHealth(campaignId);
  if (!result) return null;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { health: result.tier }
  });
  return result;
}

/**
 * Bulk recompute health for every active campaign in an org.
 * Used by the manual "Recompute all" button + by the campaign-list page header.
 */
export async function recomputeOrgCampaignHealth(orgId: string): Promise<{
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
  results: CampaignHealthResult[];
}> {
  const campaigns = await prisma.campaign.findMany({
    where: { orgId, status: { notIn: ["ARCHIVED"] } },
    select: { id: true }
  });

  const results: CampaignHealthResult[] = [];
  for (const c of campaigns) {
    const r = await recomputeCampaignHealth(c.id);
    if (r) results.push(r);
  }

  return {
    total: results.length,
    healthy: results.filter((r) => r.tier === "Healthy").length,
    atRisk: results.filter((r) => r.tier === "At Risk").length,
    critical: results.filter((r) => r.tier === "Critical").length,
    results: results.sort((a, b) => a.score - b.score)
  };
}
