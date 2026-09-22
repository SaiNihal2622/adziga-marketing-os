// Adziga — LTVService (Sprint 12b)
// True customer LTV computation using the Revenue event log.
//
// Once a Customer has additional Revenue rows beyond the initial
// `Customer.revenue`, we can compute:
//
//   • Total LTV per customer = Customer.revenue + SUM(Revenue.amount WHERE customerId)
//   • p25 / p50 / p75 / p90 LTV across the org (or per-client)
//   • Revenue-by-age curve (avg revenue N months after acquisition)
//
// The Service is the canonical answer for "how valuable is a customer
// over their lifetime?". Combined with CAC, the LTV/CAC ratio
// (Sprint 7d) becomes a real measurement instead of a proxy.

import { prisma } from "@/lib/db";

export type LtvRow = {
  customerId: string;
  clientId: string;
  clientName: string;
  name: string | null;
  acquiredAt: string;
  monthsSinceAcquisition: number;
  initialRevenue: number;
  repeatRevenue: number;
  totalRevenue: number;
  revenueEventCount: number;
};

export type LtvReport = {
  window: { since: string; until: string };
  overall: {
    n: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    repeatShare: number; // % of customers with at least one repeat Revenue row
    avgRevenuePerCustomerPerMonth: number;
  };
  byClient: Array<{
    clientId: string;
    clientName: string;
    n: number;
    p50: number;
    mean: number;
    repeatShare: number;
  }>;
  byAge: Array<{
    monthsSinceAcquisition: number;
    avgRevenue: number;
    n: number;
  }>;
  rows: LtvRow[];
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

export const LtvService = {
  /**
   * Compute the LTV report for an org.
   *
   * `windowDays` controls how far back we look for Customer + Revenue
   * rows (we want customers old enough to have generated repeat revenue).
   * Default 365 days.
   */
  async report(orgId: string, clientId?: string, windowDays: number = 365): Promise<LtvReport> {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const until = new Date();

    // Pull all customers in the window + their Revenue events (separate
    // to avoid join-row explosions).
    const customers = await prisma.customer.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {}),
        acquiredAt: { gte: since }
      },
      include: {
        client: { select: { businessName: true } },
        revenues: { select: { amount: true, kind: true, recordedAt: true } }
      }
    });

    if (customers.length === 0) {
      return {
        window: { since: since.toISOString(), until: until.toISOString() },
        overall: { n: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0, repeatShare: 0, avgRevenuePerCustomerPerMonth: 0 },
        byClient: [],
        byAge: [],
        rows: [],
        computedAt: new Date().toISOString()
      };
    }

    const now = new Date();
    const totals: number[] = [];
    const byClientMap = new Map<string, { clientName: string; n: number; totals: number[]; repeatCount: number }>();
    const byAgeMap = new Map<number, { total: number; n: number }>();
    let repeatCustomers = 0;
    const rows: LtvRow[] = [];

    for (const c of customers) {
      const monthsSince = Math.max(1, Math.round((now.getTime() - c.acquiredAt.getTime()) / (30 * 86_400_000)));
      const repeat = c.revenues.reduce((s, r) => s + r.amount, 0);
      const total = c.revenue + repeat;

      totals.push(total);
      if (c.revenues.length > 0) repeatCustomers++;

      const clientKey = c.clientId;
      if (!byClientMap.has(clientKey)) {
        byClientMap.set(clientKey, {
          clientName: c.client?.businessName ?? "—",
          n: 0,
          totals: [],
          repeatCount: 0
        });
      }
      const slot = byClientMap.get(clientKey)!;
      slot.n++;
      slot.totals.push(total);
      if (c.revenues.length > 0) slot.repeatCount++;

      if (!byAgeMap.has(monthsSince)) byAgeMap.set(monthsSince, { total: 0, n: 0 });
      const ageSlot = byAgeMap.get(monthsSince)!;
      ageSlot.total += total;
      ageSlot.n++;

      rows.push({
        customerId: c.id,
        clientId: c.clientId,
        clientName: c.client?.businessName ?? "—",
        name: c.name,
        acquiredAt: c.acquiredAt.toISOString(),
        monthsSinceAcquisition: monthsSince,
        initialRevenue: c.revenue,
        repeatRevenue: repeat,
        totalRevenue: total,
        revenueEventCount: c.revenues.length
      });
    }

    totals.sort((a, b) => a - b);

    const byClient = Array.from(byClientMap.entries())
      .map(([clientId, slot]) => {
        const sorted = slot.totals.slice().sort((a, b) => a - b);
        const mean = slot.totals.reduce((s, v) => s + v, 0) / slot.totals.length;
        return {
          clientId,
          clientName: slot.clientName,
          n: slot.n,
          p50: percentile(sorted, 0.5),
          mean,
          repeatShare: slot.repeatCount / slot.totals.length
        };
      })
      .sort((a, b) => b.mean - a.mean);

    const byAge = Array.from(byAgeMap.entries())
      .map(([monthsSinceAcquisition, slot]) => ({
        monthsSinceAcquisition,
        avgRevenue: slot.n > 0 ? slot.total / slot.n : 0,
        n: slot.n
      }))
      .sort((a, b) => a.monthsSinceAcquisition - b.monthsSinceAcquisition);

    const mean = totals.reduce((s, v) => s + v, 0) / totals.length;
    const repeatShare = repeatCustomers / customers.length;
    const avgPerMonth = totals.reduce((s, v, i) => {
      const monthsSince = Math.max(1, Math.round((now.getTime() - customers[i].acquiredAt.getTime()) / (30 * 86_400_000)));
      return s + v / monthsSince;
    }, 0) / totals.length;

    return {
      window: { since: since.toISOString(), until: until.toISOString() },
      overall: {
        n: totals.length,
        p25: percentile(totals, 0.25),
        p50: percentile(totals, 0.5),
        p75: percentile(totals, 0.75),
        p90: percentile(totals, 0.9),
        mean,
        repeatShare,
        avgRevenuePerCustomerPerMonth: avgPerMonth
      },
      byClient,
      byAge,
      rows: rows.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 100),
      computedAt: new Date().toISOString()
    };
  },

  /**
   * Record a new revenue event for an existing customer. Used by the
   * agent (or any client) to add repeat-purchase revenue.
   *
   * Idempotent on `externalRef` — re-uploading the same invoice doesn't
   * double-count.
   */
  async recordRevenue(input: {
    orgId: string;
    customerId: string;
    amount: number;
    kind?: "product" | "subscription" | "upsell" | "referral" | "other";
    externalRef?: string;
    source?: string;
    clientId?: string;
    campaignId?: string;
  }) {
    if (input.amount <= 0) throw new Error("amount must be positive");

    // Idempotency on externalRef.
    if (input.externalRef) {
      const existing = await prisma.revenue.findUnique({
        where: { externalRef: input.externalRef }
      });
      if (existing) return { revenue: existing, deduped: true };
    }

    const r = await prisma.revenue.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        clientId: input.clientId,
        campaignId: input.campaignId,
        amount: input.amount,
        kind: input.kind ?? "product",
        source: input.source,
        externalRef: input.externalRef
      }
    });

    // Update customer rolling total so dashboards reflect immediately.
    await prisma.customer.update({
      where: { id: input.customerId },
      data: { revenue: { increment: input.amount } }
    });

    return { revenue: r, deduped: false };
  }
};
