// Adziga — /app/clients/[id]/cohorts
// Sprint 8a — cohort retention matrix per client.
// Triangular heatmap: rows = acquisition month, cols = months-to-conversion.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CohortService } from "@/server/services/cohort-service";
import { PageHeader } from "../../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../../_components/ui";
import { fmtPct, fmtINR, fmtNum } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS = [3, 6, 9, 12] as const;

export default async function CohortsPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { months?: string };
}) {
  const session = await requireSession();
  const months = (MONTH_OPTIONS as readonly number[]).includes(Number(searchParams.months))
    ? Number(searchParams.months)
    : 6;

  const client = await (await import("@/lib/db")).prisma.client.findFirst({
    where: { id: params.id, orgId: session.orgId },
    select: { id: true, businessName: true }
  });
  if (!client) notFound();

  const cohort = await CohortService.leadToCustomerCohort(session.orgId, params.id, months);
  const customerCohort = await CohortService.customerAcquisitionCohort(session.orgId, params.id, months);

  // Heat scale: green if high retention, red if low.
  function heat(v: number, maxV: number): string {
    if (v === 0) return "bg-ink-100 text-ink-400";
    const intensity = Math.min(v / Math.max(maxV, 0.001), 1);
    if (intensity >= 0.5) return "bg-emerald-500 text-white";
    if (intensity >= 0.25) return "bg-emerald-300 text-emerald-900";
    if (intensity >= 0.1) return "bg-emerald-100 text-emerald-800";
    if (intensity >= 0.05) return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-700";
  }

  const totalLeads = cohort.cohortSizes.reduce((s, v) => s + v, 0);
  const totalConverted = cohort.matrix.reduce((s, row) => s + row.slice(0, months).reduce((ss, v) => ss + v, 0), 0);
  const totalRevenue = customerCohort.revenue.reduce((s, v) => s + v, 0);
  const blendedConversion = totalLeads > 0 ? totalConverted / totalLeads : 0;
  const avgRev = totalConverted > 0 ? totalRevenue / totalConverted : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${client.businessName} — Cohorts`}
        subtitle={`Lead → customer conversion by acquisition month. Last ${months} months. Each row = leads acquired in that month; columns = months to conversion.`}
        breadcrumbs={[
          { label: "Clients", href: "/app/clients" },
          { label: client.businessName, href: `/app/clients/${params.id}` },
          { label: "ROI", href: `/app/clients/${params.id}/roi` },
          { label: "Cohorts" }
        ]}
      />

      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Window:</span>
        {MONTH_OPTIONS.map((m) => (
          <Link
            key={m}
            href={`?months=${m}`}
            className={`px-3 py-1 rounded-md ${
              m === months ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {m}mo
          </Link>
        ))}
        <a
          href={`/api/analytics/cohorts/export?clientId=${params.id}&months=${months}`}
          className="ml-2 px-3 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700"
        >
          ↓ CSV
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total leads" value={fmtNum(totalLeads)} hint={`${months}-month window`} />
        <Kpi
          label="Total converted"
          value={fmtNum(totalConverted)}
          hint={`${fmtPct(blendedConversion, 1)} overall`}
          tone={blendedConversion >= 0.1 ? "success" : "neutral"}
        />
        <Kpi label="Total revenue" value={fmtINR(totalRevenue)} />
        <Kpi label="Avg deal" value={fmtINR(avgRev)} hint="revenue / converted" />
      </div>

      {cohort.note && (
        <Card>
          <p className="text-sm text-ink-500 text-center py-6">{cohort.note}</p>
        </Card>
      )}

      {!cohort.note && (
        <>
          <SectionHeader title="Lead → customer cohort retention" description="How long did it take leads from each cohort to convert?" />

          <Card>
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1 text-ink-500 font-medium">Cohort</th>
                    <th className="text-right px-2 py-1 text-ink-500 font-medium">Size</th>
                    {Array.from({ length: months + 1 }).map((_, j) => (
                      <th key={j} className="px-2 py-1 text-ink-500 font-medium text-center min-w-[64px]">
                        {j === months ? "still open" : j === 0 ? "M0" : `M${j}`}
                      </th>
                    ))}
                    <th className="text-right px-2 py-1 text-ink-500 font-medium">Cum. conv</th>
                    <th className="text-right px-2 py-1 text-ink-500 font-medium">Avg rev</th>
                  </tr>
                </thead>
                <tbody>
                  {cohort.cohortLabels.map((label, i) => {
                    const rowMax = Math.max(...cohort.matrix[i]);
                    return (
                      <tr key={label}>
                        <td className="px-2 py-1 font-mono text-ink-900">{label}</td>
                        <td className="px-2 py-1 text-right font-mono text-ink-700">{cohort.cohortSizes[i]}</td>
                        {cohort.matrix[i].map((count, j) => (
                          <td key={j} className={`px-2 py-1 text-center rounded-md ${heat(cohort.retention[i][j], rowMax > 0 ? rowMax / Math.max(cohort.cohortSizes[i], 1) : 1)}`}>
                            {count > 0 ? (
                              <div>
                                <div className="font-mono">{count}</div>
                                <div className="text-[10px] opacity-75">{fmtPct(cohort.retention[i][j], 0)}</div>
                              </div>
                            ) : (
                              <span className="text-ink-400">·</span>
                            )}
                          </td>
                        ))}
                        <td className={`px-2 py-1 text-right font-mono font-semibold ${cohort.cumulativeConversion[i] >= 0.1 ? "text-emerald-700" : cohort.cumulativeConversion[i] > 0 ? "text-amber-700" : "text-rose-700"}`}>
                          {fmtPct(cohort.cumulativeConversion[i], 1)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-ink-700">
                          {cohort.avgRevenuePerCustomer[i] > 0 ? fmtINR(cohort.avgRevenuePerCustomer[i]) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-ink-500">
              <span>Heat:</span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">&lt;5%</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">5-10%</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">10-25%</span>
              <span className="px-2 py-0.5 rounded bg-emerald-300 text-emerald-900">25-50%</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-white">≥50%</span>
            </div>
          </Card>

          {(cohort.bestCohort || cohort.worstCohort) && (
            <div className="grid md:grid-cols-2 gap-3">
              {cohort.bestCohort && (
                <Card>
                  <h4 className="text-xs uppercase tracking-wide text-ink-500 mb-1">Best cohort</h4>
                  <div className="flex items-baseline gap-2">
                    <Badge variant="success">{cohort.bestCohort.label}</Badge>
                    <span className="text-2xl font-mono font-semibold text-emerald-700">{fmtPct(cohort.bestCohort.rate, 1)}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">Leads acquired in this month had the strongest conversion rate.</p>
                </Card>
              )}
              {cohort.worstCohort && (
                <Card>
                  <h4 className="text-xs uppercase tracking-wide text-ink-500 mb-1">Worst cohort</h4>
                  <div className="flex items-baseline gap-2">
                    <Badge variant="warning">{cohort.worstCohort.label}</Badge>
                    <span className="text-2xl font-mono font-semibold text-rose-700">{fmtPct(cohort.worstCohort.rate, 1)}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">Investigate lead sources or campaigns from this month — they underperformed.</p>
                </Card>
              )}
            </div>
          )}

          <SectionHeader title="Customers per acquisition month" description="Volume + cumulative revenue" />

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-500 border-b border-ink-200">
                  <tr>
                    <th className="text-left py-2">Month</th>
                    <th className="text-right">Customers</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Avg / customer</th>
                    <th className="text-right">Cum. customers</th>
                    <th className="text-right">Cum. revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {customerCohort.labels.map((label, i) => (
                    <tr key={label} className="border-b border-ink-100">
                      <td className="py-2 font-mono">{label}</td>
                      <td className="text-right font-mono">{customerCohort.counts[i]}</td>
                      <td className="text-right font-mono">{fmtINR(customerCohort.revenue[i])}</td>
                      <td className="text-right font-mono">{fmtINR(customerCohort.avgRevenue[i])}</td>
                      <td className="text-right font-mono">{customerCohort.cumulativeCustomers[i]}</td>
                      <td className="text-right font-mono">{fmtINR(customerCohort.cumulativeRevenue[i])}</td>
                    </tr>
                  ))}
                  {customerCohort.counts.every((c) => c === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center text-ink-500 py-6">
                        No customers in this window yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
