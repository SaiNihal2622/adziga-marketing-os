// Adziga — CohortService (Sprint 8a)
// Cohort retention analysis for leads and customers.
//
// Two outputs:
//   • leadToCustomerCohort(orgId, clientId?, months) —
//     Triangular matrix of cohort (acquisition month) → months-to-conversion.
//     For each acquisition month, what fraction of leads converted in
//     month 0 (same month), month 1, month 2, month 3+? Plus a
//     "still_open" bucket for leads that haven't converted yet.
//
//   • customerAcquisitionCohort(orgId, clientId?, months) —
//     Simpler cohort: customers per acquisition month + revenue total.
//
// The lead cohort is the headline retention number we care about —
// it's how you measure "how fast does a lead convert, and how many
// convert at all" by acquisition source / time period.
//
// Without explicit repeat-purchase data (we don't have subscriptions),
// we use conversion-lag as a proxy for retention: a "12-month cohort"
// having 40% conversion by month 3 is a strong signal of healthy
// lead-to-customer flow.

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type CohortMatrix = {
  months: number;
  cohortLabels: string[];            // e.g. ["2025-10", "2025-11", ...]
  cohortSizes: number[];             // leads in each cohort
  /** matrix[i][j] = count of leads in cohort i that converted in month j */
  matrix: number[][];
  /** % retained by month j for each cohort. Aligned to matrix. */
  retention: number[][];
  /** Total converted / total leads per cohort (cumulative). */
  cumulativeConversion: number[];
  /** Mean revenue per converted customer per cohort. */
  avgRevenuePerCustomer: number[];
  /** Best / worst cohort by cumulative conversion. */
  bestCohort: { label: string; rate: number } | null;
  worstCohort: { label: string; rate: number } | null;
  /** Caveats for empty cohorts. */
  note: string | null;
  computedAt: string;
};

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export const CohortService = {
  /**
   * Lead-to-customer cohort retention matrix.
   *
   * @param orgId    The org
   * @param clientId Optional client scope
   * @param months   How many months back to look (default 6)
   */
  async leadToCustomerCohort(
    orgId: string,
    clientId?: string,
    months: number = 6
  ): Promise<CohortMatrix> {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCMonth(since.getUTCMonth() - (months - 1));

    // 1. Pull every lead in window + its customer row (if any).
    // We use a raw query for efficiency since the join is straightforward.
    const rows = await prisma.$queryRaw<Array<{
      leadId: string;
      leadCohort: Date;
      customerAcquired: Date | null;
      revenue: number | null;
    }>>`
      SELECT
        l.id AS "leadId",
        date_trunc('month', l."createdAt") AS "leadCohort",
        c."acquiredAt" AS "customerAcquired",
        c.revenue AS revenue
      FROM "Lead" l
      LEFT JOIN "Customer" c ON c."leadId" = l.id
      WHERE l."orgId" = ${orgId}
        ${clientId ? Prisma.sql`AND l."clientId" = ${clientId}` : Prisma.empty}
        AND l."createdAt" >= ${since}
    `.catch(() => [] as any[]);

    if (rows.length === 0) {
      const emptyLabels: string[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - i);
        emptyLabels.push(monthKey(d));
      }
      return {
        months,
        cohortLabels: emptyLabels,
        cohortSizes: emptyLabels.map(() => 0),
        matrix: emptyLabels.map(() => []),
        retention: emptyLabels.map(() => []),
        cumulativeConversion: emptyLabels.map(() => 0),
        avgRevenuePerCustomer: emptyLabels.map(() => 0),
        bestCohort: null,
        worstCohort: null,
        note: "No leads in the chosen window. Cohort analysis needs at least one lead to compute retention.",
        computedAt: new Date().toISOString()
      };
    }

    // 2. Build cohort labels and sizes.
    const cohortLabels: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() - i);
      cohortLabels.push(monthKey(d));
    }
    const cohortIdx = new Map(cohortLabels.map((l, i) => [l, i]));
    const cohortSizes = new Array(months).fill(0);
    // matrix[i][j] = count of leads from cohort i that converted in cohort-month j
    // where j=0 means "same month as acquisition", j=1 means "next month", etc.
    // j=months means "still open (no conversion yet)" — we'll fill it last.
    const matrix: number[][] = Array.from({ length: months }, () => new Array(months + 1).fill(0));
    const revenueByCohort = new Array(months).fill(0);
    let convertedByCohort = new Array(months).fill(0);

    // "Now" = current month. Leads that haven't converted yet but are still
    // in cohorts that aren't stale get bucketed into "still_open".
    const nowKey = monthKey(new Date());

    for (const r of rows) {
      const ck = monthKey(r.leadCohort);
      const idx = cohortIdx.get(ck);
      if (idx === undefined) continue;
      cohortSizes[idx]++;
      if (r.customerAcquired) {
        const convKey = monthKey(r.customerAcquired);
        const diff = monthDiff(ck, convKey);
        const clamped = Math.min(Math.max(diff, 0), months);
        matrix[idx][clamped]++;
        revenueByCohort[idx] += r.revenue ?? 0;
        convertedByCohort[idx]++;
      } else {
        // Still-open: only count if the cohort is "current or recent"
        // (otherwise it's just a really old lead that will never convert)
        const cohortAge = monthDiff(ck, nowKey);
        if (cohortAge < months) {
          matrix[idx][months]++; // last column = still_open
        }
      }
    }

    // 3. Build retention % matrix.
    const retention: number[][] = matrix.map((row, i) => {
      const total = cohortSizes[i] || 1;
      return row.map((count) => count / total);
    });

    const cumulativeConversion = cohortSizes.map((_, i) => {
      const total = cohortSizes[i] || 1;
      const converted = matrix[i].slice(0, months).reduce((s, v) => s + v, 0);
      return converted / total;
    });
    const avgRevenuePerCustomer = cohortSizes.map((_, i) => {
      return convertedByCohort[i] > 0 ? revenueByCohort[i] / convertedByCohort[i] : 0;
    });

    // Best / worst by cumulative conversion (only count cohorts with ≥5 leads to avoid noise).
    const eligible = cohortSizes
      .map((size, i) => ({ size, idx: i, rate: cumulativeConversion[i] }))
      .filter((c) => c.size >= 5);
    const best = eligible.length > 0 ? eligible.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
    const worst = eligible.length > 0 ? eligible.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

    return {
      months,
      cohortLabels,
      cohortSizes,
      matrix,
      retention,
      cumulativeConversion,
      avgRevenuePerCustomer,
      bestCohort: best ? { label: cohortLabels[best.idx], rate: best.rate } : null,
      worstCohort: worst ? { label: cohortLabels[worst.idx], rate: worst.rate } : null,
      note: null,
      computedAt: new Date().toISOString()
    };
  },

  /**
   * Simpler customer acquisition cohort: customers per acquisition month
   * with cumulative revenue and average revenue per customer.
   */
  async customerAcquisitionCohort(orgId: string, clientId?: string, months: number = 6) {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCMonth(since.getUTCMonth() - (months - 1));

    const rows = await prisma.$queryRaw<Array<{ cohort: Date; n: bigint; rev: number }>>`
      SELECT
        date_trunc('month', "acquiredAt") AS cohort,
        COUNT(*)::bigint AS n,
        COALESCE(SUM("revenue"), 0)::float AS rev
      FROM "Customer"
      WHERE "orgId" = ${orgId}
        ${clientId ? Prisma.sql`AND "clientId" = ${clientId}` : Prisma.empty}
        AND "acquiredAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `.catch(() => [] as any[]);

    const labels: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() - i);
      labels.push(monthKey(d));
    }
    const labelIdx = new Map(labels.map((l, i) => [l, i]));
    const counts = new Array(months).fill(0);
    const revenue = new Array(months).fill(0);
    for (const r of rows) {
      const idx = labelIdx.get(monthKey(r.cohort));
      if (idx === undefined) continue;
      counts[idx] = Number(r.n);
      revenue[idx] = Number(r.rev);
    }
    return {
      months,
      labels,
      counts,
      revenue,
      avgRevenue: counts.map((c, i) => (c > 0 ? revenue[i] / c : 0)),
      cumulativeCustomers: counts.reduce((acc: number[], _, i) => [...acc, (acc[i - 1] ?? 0) + counts[i]], []),
      cumulativeRevenue: revenue.reduce((acc: number[], _, i) => [...acc, (acc[i - 1] ?? 0) + revenue[i]], [])
    };
  },

  /**
   * Sprint 11e — cohort retention by acquisition channel.
   * Same triangular matrix but split per Campaign.platform.
   * Returns per-platform cohort matrices so the UI can render side-by-side.
   */
  async cohortByPlatform(
    orgId: string,
    clientId?: string,
    months: number = 6
  ): Promise<{
    months: number;
    cohortLabels: string[];
    platforms: Array<{
      platform: string;
      cohortSizes: number[];
      cumulativeConversion: number[];
      matrix: number[][];
    }>;
    caveat: string | null;
    computedAt: string;
  }> {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCMonth(since.getUTCMonth() - (months - 1));

    const rows = await prisma.$queryRaw<Array<{
      leadId: string;
      leadCohort: Date;
      customerAcquired: Date | null;
      platform: string;
    }>>`
      SELECT
        l.id AS "leadId",
        date_trunc('month', l."createdAt") AS "leadCohort",
        c."acquiredAt" AS "customerAcquired",
        COALESCE(camp.platform, 'unknown') AS platform
      FROM "Lead" l
      LEFT JOIN "Customer" c ON c."leadId" = l.id
      LEFT JOIN "Campaign" camp ON camp.id = l."campaignId"
      WHERE l."orgId" = ${orgId}
        ${clientId ? Prisma.sql`AND l."clientId" = ${clientId}` : Prisma.empty}
        AND l."createdAt" >= ${since}
    `.catch(() => [] as any[]);

    if (rows.length === 0) {
      const emptyLabels: string[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCMonth(d.getUTCMonth() - i);
        emptyLabels.push(monthKey(d));
      }
      return {
        months,
        cohortLabels: emptyLabels,
        platforms: [],
        caveat: "No leads in the chosen window.",
        computedAt: new Date().toISOString()
      };
    }

    // Build cohort labels
    const cohortLabels: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() - i);
      cohortLabels.push(monthKey(d));
    }
    const cohortIdx = new Map(cohortLabels.map((l, i) => [l, i]));

    // Group by platform
    const byPlatform = new Map<string, { cohortSizes: number[]; matrix: number[][] }>();
    for (const r of rows) {
      const ck = monthKey(r.leadCohort);
      const idx = cohortIdx.get(ck);
      if (idx === undefined) continue;
      let bucket = byPlatform.get(r.platform);
      if (!bucket) {
        bucket = {
          cohortSizes: new Array(months).fill(0),
          matrix: Array.from({ length: months }, () => new Array(months + 1).fill(0))
        };
        byPlatform.set(r.platform, bucket);
      }
      bucket.cohortSizes[idx]++;
      if (r.customerAcquired) {
        const convKey = monthKey(r.customerAcquired);
        const diff = monthDiff(ck, convKey);
        const clamped = Math.min(Math.max(diff, 0), months);
        bucket.matrix[idx][clamped]++;
      } else {
        const cohortAge = monthDiff(ck, monthKey(new Date()));
        if (cohortAge < months) bucket.matrix[idx][months]++;
      }
    }

    const platforms = Array.from(byPlatform.entries()).map(([platform, bucket]) => {
      const cumulativeConversion = bucket.cohortSizes.map((_, i) => {
        const total = bucket.cohortSizes[i] || 1;
        const converted = bucket.matrix[i].slice(0, months).reduce((s, v) => s + v, 0);
        return converted / total;
      });
      return { platform, cohortSizes: bucket.cohortSizes, matrix: bucket.matrix, cumulativeConversion };
    }).sort((a, b) => {
      const aTotal = a.cohortSizes.reduce((s, v) => s + v, 0);
      const bTotal = b.cohortSizes.reduce((s, v) => s + v, 0);
      return bTotal - aTotal;
    });

    return {
      months,
      cohortLabels,
      platforms,
      caveat: null,
      computedAt: new Date().toISOString()
    };
  },

  /**
   * Sprint 19a — revenue by acquisition month. For each monthly cohort
   * of Customer.acquiredAt, return the cumulative revenue generated
   * (initial Customer.revenue + repeat Revenue.amount) per cohort.
   *
   * Power user view: "older cohorts should earn more".
   */
  async cohortRevenueLtv(
    orgId: string,
    clientId?: string,
    months: number = 6
  ): Promise<{
    months: number;
    cohortLabels: string[];
    cohortSizes: number[];
    cumulativeRevenuePerCohort: number[];   // [oldest .. newest]
    cumulativeRevenuePerCustomer: number[]; // same shape, averaged
    repeatShareByCohort: number[];           // 0..1
    totalRevenue: number;
    note?: string;
    computedAt: string;
  }> {
    // Cohort labels same as leadToCustomerCohort (oldest left, newest right).
    const now = new Date();
    const labels: string[] = [];
    const sizes: number[] = [];
    const cumulative: number[] = [];
    const perCustomer: number[] = [];
    const repeatShare: number[] = [];

    let totalRevenue = 0;

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

      const customers = await prisma.customer.findMany({
        where: {
          orgId,
          ...(clientId ? { clientId } : {}),
          acquiredAt: { gte: start, lt: next }
        },
        include: {
          revenues: { select: { amount: true } }
        }
      });

      const n = customers.length;
      const cohortRev = customers.reduce((s, c) => s + c.revenue, 0);
      const repeatRev = customers.reduce((s, c) => s + c.revenues.reduce((x, r) => x + r.amount, 0), 0);
      const total = cohortRev + repeatRev;
      const withRepeats = customers.filter((c) => c.revenues.length > 0).length;

      labels.push(label);
      sizes.push(n);
      cumulative.push(Math.round(total));
      perCustomer.push(n > 0 ? Math.round(total / n) : 0);
      repeatShare.push(n > 0 ? withRepeats / n : 0);
      totalRevenue += total;
    }

    const note = months < 3
      ? "Need at least 3 monthly cohorts to spot revenue trends. Check back next month."
      : undefined;

    return {
      months,
      cohortLabels: labels,
      cohortSizes: sizes,
      cumulativeRevenuePerCohort: cumulative,
      cumulativeRevenuePerCustomer: perCustomer,
      repeatShareByCohort: repeatShare,
      totalRevenue,
      note,
      computedAt: new Date().toISOString()
    };
  }
};
