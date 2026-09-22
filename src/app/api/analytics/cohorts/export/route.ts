// Adziga — /api/analytics/cohorts/export
// Sprint 10c — CSV export of cohort retention matrix.

import { authedRoute } from "@/server/api";
import { CohortService } from "@/server/services/cohort-service";
import { toCsv } from "@/lib/csv";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const clientId = url.searchParams.get("clientId");
  const days = Number(url.searchParams.get("months") ?? url.searchParams.get("days") ?? 6);
  if (!clientId) return new Response(JSON.stringify({ error: "clientId required" }), { status: 422 });

  const report = await CohortService.leadToCustomerCohort(ctx.orgId, clientId, days);
  // Build a long-format CSV: cohort, month_offset, count, retention, total_in_cohort
  const rows = report.cohortLabels.flatMap((label, i) =>
    report.matrix[i].map((count, j) => ({
      cohort: label,
      monthOffset: j === report.months ? "still_open" : `M${j}`,
      leadsInCohort: report.cohortSizes[i],
      convertedInPeriod: count,
      retention: report.retention[i][j],
      cumulativeConversion: report.cumulativeConversion[i]
    }))
  );
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cohorts-${clientId}-${days}m.csv"`
    }
  });
});
