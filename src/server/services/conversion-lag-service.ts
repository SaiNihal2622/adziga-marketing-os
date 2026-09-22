// Adziga — ConversionLagService (Sprint 10b)
// Reports lead → customer conversion lag percentiles broken down by channel.
//
// Operational question: "how long does it actually take for a lead to
// become a customer, and does that differ by source platform?"
//
// Inputs:
//   • Every Lead has createdAt + (if converted) a Customer row with
//     acquiredAt. The lag = acquiredAt - createdAt.
//   • Channel comes from Lead.campaignId → Campaign.platform.
//
// Output per-channel:
//   • p25 / p50 / p75 / p90 lag in days
//   • Count of converted leads (n)
//   • Mean revenue per converted customer
//
// Pure read; no writes.

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type ChannelLagRow = {
  platform: string;
  n: number;            // number of converted leads in window
  p25: number;          // days
  p50: number;
  p75: number;
  p90: number;
  meanLagDays: number;
  meanRevenue: number;
};

export type ConversionLagReport = {
  window: { since: string; until: string; days: number };
  overall: {
    n: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    meanLagDays: number;
    meanRevenue: number;
  };
  byPlatform: ChannelLagRow[];
  computedAt: string;
};

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

export const ConversionLagService = {
  /**
   * Compute conversion-lag percentiles across the org, optionally scoped
   * to a client.
   */
  async report(orgId: string, days: number = 90, clientId?: string): Promise<ConversionLagReport> {
    const since = new Date(Date.now() - days * 86_400_000);

    // Pull (Lead.createdAt, Customer.acquiredAt, revenue, platform) tuples
    // for every converted lead in the window.
    const rows = await prisma.$queryRaw<Array<{
      leadCreated: Date;
      customerAcquired: Date;
      revenue: number;
      platform: string;
    }>>`
      SELECT l."createdAt" AS "leadCreated",
             c."acquiredAt" AS "customerAcquired",
             c."revenue" AS revenue,
             COALESCE(camp.platform, 'unknown') AS platform
      FROM "Lead" l
      JOIN "Customer" c ON c."leadId" = l.id
      LEFT JOIN "Campaign" camp ON camp.id = l."campaignId"
      WHERE l."orgId" = ${orgId}
        ${clientId ? Prisma.sql`AND l."clientId" = ${clientId}` : Prisma.empty}
        AND l."createdAt" >= ${since}
        AND c."acquiredAt" IS NOT NULL
        AND c."acquiredAt" >= l."createdAt"
    `.catch(() => [] as any[]);

    if (rows.length === 0) {
      return {
        window: { since: since.toISOString(), until: new Date().toISOString(), days },
        overall: { n: 0, p25: 0, p50: 0, p75: 0, p90: 0, meanLagDays: 0, meanRevenue: 0 },
        byPlatform: [],
        computedAt: new Date().toISOString()
      };
    }

    // Build per-platform lag arrays + revenue sums.
    const byPlatform = new Map<string, { lags: number[]; revenue: number }>();
    const allLags: number[] = [];
    let totalRevenue = 0;

    for (const r of rows) {
      const lagDays = Math.max(0, (r.customerAcquired.getTime() - r.leadCreated.getTime()) / 86_400_000);
      allLags.push(lagDays);
      totalRevenue += Number(r.revenue);
      if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, { lags: [], revenue: 0 });
      const slot = byPlatform.get(r.platform)!;
      slot.lags.push(lagDays);
      slot.revenue += Number(r.revenue);
    }

    allLags.sort((a, b) => a - b);

    const platformRows: ChannelLagRow[] = Array.from(byPlatform.entries()).map(([platform, slot]) => {
      slot.lags.sort((a, b) => a - b);
      const mean = slot.lags.reduce((s, v) => s + v, 0) / slot.lags.length;
      return {
        platform,
        n: slot.lags.length,
        p25: percentile(slot.lags, 0.25),
        p50: percentile(slot.lags, 0.5),
        p75: percentile(slot.lags, 0.75),
        p90: percentile(slot.lags, 0.9),
        meanLagDays: mean,
        meanRevenue: slot.revenue / slot.lags.length
      };
    }).sort((a, b) => b.n - a.n);

    return {
      window: { since: since.toISOString(), until: new Date().toISOString(), days },
      overall: {
        n: allLags.length,
        p25: percentile(allLags, 0.25),
        p50: percentile(allLags, 0.5),
        p75: percentile(allLags, 0.75),
        p90: percentile(allLags, 0.9),
        meanLagDays: allLags.reduce((s, v) => s + v, 0) / allLags.length,
        meanRevenue: totalRevenue / allLags.length
      },
      byPlatform: platformRows,
      computedAt: new Date().toISOString()
    };
  }
};
