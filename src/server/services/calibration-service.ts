// Adziga — CalibrationService (Sprint 18a)
// Self-check on the PredictiveOutcomeModel. For every recent campaign
// with outcome data, re-runs the predictive model on the same
// (industry, platform, budget) inputs and computes:
//
//   • predictedCpl  — what the model would have predicted today
//   • actualCpl     — observed spent / leads
//   • errorRatio    — abs((predicted - actual) / actual)
//
// Aggregated by platform and industry into MAPE (mean absolute
// percent error), bias (mean signed error), and count. The result is
// persisted to Organization.metadata.calibration (last snapshot only)
// so the dashboard can render instantly without recomputing on every
// page load.
//
// Coverage only includes campaigns with non-zero leads AND spent, so
// brand-new campaigns (no signal) don't poison the average.

import { prisma } from "@/lib/db";
import { PredictiveOutcomeModel } from "./predictive-service";

export type CalibrationRow = {
  clientId: string;
  clientName: string;
  campaignId: string;
  campaignName: string;
  platform: string;
  industry: string;
  budget: number;
  spent: number;
  leads: number;
  customers: number;
  predictedCpl: number;
  actualCpl: number;
  absErrorRatio: number;     // |predicted - actual| / max(1, actual)
  signedErrorRatio: number;  // (predicted - actual) / actual
};

export type CalibrationBucket = {
  key: string;          // platform or industry
  n: number;
  meanActualCpl: number;
  meanPredictedCpl: number;
  mape: number;          // 0..1
  bias: number;          // -1..1; positive = under-predicts actual
  medianAbsErrorRatio: number;
};

export type CalibrationSnapshot = {
  windowDays: number;
  totalCampaignsEvaluated: number;
  coveredCampaigns: number;
  overallMape: number;
  overallBias: number;
  byPlatform: CalibrationBucket[];
  byIndustry: CalibrationBucket[];
  rows: CalibrationRow[];
  computedAt: string;
  note?: string;
};

const STORAGE_KEY = "calibration";

function safeJsonParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function bucketBy(rows: CalibrationRow[], key: "platform" | "industry"): CalibrationBucket[] {
  const groups = new Map<string, CalibrationRow[]>();
  for (const r of rows) {
    const k = (r as any)[key] as string;
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  return Array.from(groups.entries())
    .map(([k, list]) => ({
      key: k,
      n: list.length,
      meanActualCpl: mean(list.map((r) => r.actualCpl)),
      meanPredictedCpl: mean(list.map((r) => r.predictedCpl)),
      mape: mean(list.map((r) => r.absErrorRatio)),
      bias: mean(list.map((r) => r.signedErrorRatio)),
      medianAbsErrorRatio: median(list.map((r) => r.absErrorRatio))
    }))
    .sort((a, b) => b.n - a.n);
}

export const CalibrationService = {
  /**
   * Re-evaluate every recent campaign through the predictive model and
   * compute calibration stats.
   */
  async evaluate(orgId: string, windowDays: number = 90, maxCampaigns: number = 80): Promise<CalibrationSnapshot> {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const campaigns = await prisma.campaign.findMany({
      where: {
        orgId,
        // only campaigns with at least some spend — otherwise the
        // comparison is meaningless (0/0).
        spent: { gt: 0 },
        leads: { gt: 0 }
      },
      include: { client: { select: { id: true, businessName: true, industry: true } } },
      orderBy: { updatedAt: "desc" },
      take: maxCampaigns
    });

    const rows: CalibrationRow[] = [];
    let note: string | undefined;

    for (const c of campaigns) {
      if (!c.client?.industry) continue;
      const totalBudget = c.budget ?? c.spent;
      const days = Math.max(
        1,
        Math.round((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000)
      );

      const prediction = await PredictiveOutcomeModel.predict({
        orgId,
        clientId: c.clientId,
        industry: c.client.industry,
        plan: {
          channels: [{ platform: c.platform, totalBudget, days }]
        }
      });

      const actualCpl = Number(c.leads) > 0 ? c.spent / Number(c.leads) : 0;
      const predictedCpl = prediction.expectedCpl;
      if (actualCpl <= 0 || predictedCpl <= 0) continue;
      const signed = (predictedCpl - actualCpl) / actualCpl;
      const abs = Math.abs(signed);

      rows.push({
        clientId: c.clientId,
        clientName: c.client.businessName,
        campaignId: c.id,
        campaignName: c.name,
        platform: c.platform,
        industry: c.client.industry,
        budget: totalBudget,
        spent: c.spent,
        leads: Number(c.leads),
        customers: Number(c.customers),
        predictedCpl,
        actualCpl,
        absErrorRatio: abs,
        signedErrorRatio: signed
      });
    }

    if (rows.length < 5) {
      note = "Need at least 5 campaigns with both spend and leads to compute reliable MAPE. Continue running campaigns to gather signal.";
    }

    const overallMape = mean(rows.map((r) => r.absErrorRatio));
    const overallBias = mean(rows.map((r) => r.signedErrorRatio));

    const snap: CalibrationSnapshot = {
      windowDays,
      totalCampaignsEvaluated: campaigns.length,
      coveredCampaigns: rows.length,
      overallMape,
      overallBias,
      byPlatform: bucketBy(rows, "platform"),
      byIndustry: bucketBy(rows, "industry"),
      rows: rows.sort((a, b) => b.absErrorRatio - a.absErrorRatio).slice(0, 100),
      computedAt: new Date().toISOString(),
      note
    };

    return snap;
  },

  /**
   * Run the evaluation and persist the snapshot to Organization.metadata.
   */
  async check(orgId: string, windowDays?: number): Promise<CalibrationSnapshot> {
    const snap = await this.evaluate(orgId, windowDays);

    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(row?.metadata);
    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify({ ...meta, [STORAGE_KEY]: snap }) }
    });

    return snap;
  },

  /**
   * Read the most recent persisted snapshot. Falls back to a fresh
   * evaluate if nothing's stored yet.
   */
  async lastSnapshot(orgId: string, windowDays: number = 90): Promise<CalibrationSnapshot> {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(row?.metadata);
    const snap = meta[STORAGE_KEY] as CalibrationSnapshot | undefined;
    if (snap) return snap;
    return this.evaluate(orgId, windowDays);
  }
};
