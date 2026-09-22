// Adziga — /app/analytics/roi
// Sprint 7a — Org-wide ROI dashboard.
// Closes point #18 of the Marketing OS vision (ROI reporting).

import { ROIService } from "@/server/services/roi-service";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { LineChart } from "../../_components/charts";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [30, 60, 90, 180] as const;

export default async function OrgRoiPage({
  searchParams
}: {
  searchParams: { days?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 60;

  const d = await ROIService.orgWideDashboard(session.orgId, days);

  const xLabels = d.timeSeries.map((p) => p.date.slice(5)); // MM-DD
  const series = [
    { name: "Revenue", color: "#10b981", data: d.timeSeries.map((p) => p.revenue) },
    { name: "Spend", color: "#ef4444", data: d.timeSeries.map((p) => p.spend) }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ROI dashboard"
        subtitle="Top-line return on the marketing investment, across all clients and channels. Updates against the last {days} days; pick a window below."
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "ROI" }]}
      />

      {/* Window picker */}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Window:</span>
        {DAY_OPTIONS.map((d2) => (
          <Link
            key={d2}
            href={`?days=${d2}`}
            className={`px-3 py-1 rounded-md ${
              d2 === days
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {d2}d
          </Link>
        ))}
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue" value={fmtINR(d.kpis.totalRevenue)} tone="success" hint={`last ${days} days`} />
        <Kpi label="Spend" value={fmtINR(d.kpis.totalSpend)} tone={d.kpis.totalSpend > 0 ? "neutral" : "neutral"} />
        <Kpi
          label="Net ROI"
          value={fmtINR(d.kpis.netRoi)}
          tone={d.kpis.netRoi > 0 ? "success" : d.kpis.netRoi < 0 ? "accent" : "neutral"}
          hint={`ROAS ${d.kpis.roas.toFixed(2)}×`}
        />
        <Kpi label="CAC" value={fmtINR(d.kpis.cac)} hint={`${d.kpis.totalCustomers} customers`} />
        <Kpi
          label="LTV/CAC"
          value={d.kpis.ltvCacRatio > 0 ? `${d.kpis.ltvCacRatio.toFixed(2)}×` : "—"}
          hint={d.kpis.ltvCacRatio >= 3 ? "Healthy" : d.kpis.ltvCacRatio >= 1 ? "Marginal" : "Below 1×"}
          tone={d.kpis.ltvCacRatio >= 3 ? "success" : d.kpis.ltvCacRatio >= 1 ? "neutral" : "accent"}
        />
        <Kpi
          label="Months to payback"
          value={d.kpis.monthsToPayback > 0 && d.kpis.monthsToPayback < 120 ? d.kpis.monthsToPayback.toFixed(1) : "—"}
          hint="at repeat rate 1.0/month"
        />
        <Kpi label="Leads" value={fmtNum(d.kpis.totalLeads)} />
        <Kpi label="Qualified" value={fmtNum(d.kpis.totalQualified)} hint={`${(d.kpis.qualifiedRate * 100).toFixed(1)}% of leads`} />
        <Kpi label="Customers" value={fmtNum(d.kpis.totalCustomers)} />
        <Kpi label="Active" value={`${d.kpis.activeClients} clients · ${d.kpis.activeCampaigns} campaigns`} hint="running right now" />
      </div>

      {/* Alerts */}
      {d.alerts.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-ink-700 mb-2">Alerts</h3>
          <ul className="space-y-1 text-xs">
            {d.alerts.map((a, i) => (
              <li
                key={i}
                className={`px-3 py-1.5 rounded-md ${
                  a.kind === "danger"
                    ? "bg-rose-50 text-rose-700"
                    : a.kind === "warning"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-sky-50 text-sky-700"
                }`}
              >
                {a.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Time series */}
      <Card>
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Daily revenue vs spend</h3>
        <div className="overflow-x-auto">
          <LineChart series={series} xLabels={xLabels} height={220} width={900} yFormat={(v) => fmtINR(v).replace("₹", "₹")} />
        </div>
      </Card>

      {/* Top clients */}
      {d.topClients.length > 0 && (
        <>
          <SectionHeader title="Top clients by revenue" description="Largest revenue contributors in the window" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.topClients.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/app/clients/${c.id}/roi?days=${days}`}>
                <Card hover>
                  <div className="font-semibold text-ink-900 truncate">{c.businessName}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <div className="text-ink-500">Revenue</div>
                      <div className="font-mono">{fmtINR(c.revenue)}</div>
                    </div>
                    <div>
                      <div className="text-ink-500">Spend</div>
                      <div className="font-mono">{fmtINR(c.spend)}</div>
                    </div>
                    <div>
                      <div className="text-ink-500">ROAS</div>
                      <div className={`font-mono ${c.roas >= 1 ? "text-emerald-700" : "text-rose-700"}`}>{c.roas.toFixed(2)}×</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* By platform */}
      <SectionHeader title="By platform" description="Spend, revenue, ROAS per channel" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200">
              <tr>
                <th className="text-left py-2">Platform</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Customers</th>
                <th className="text-right">CAC</th>
                <th className="text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {d.byPlatform.map((p) => (
                <tr key={p.platform} className="border-b border-ink-100">
                  <td className="py-2 font-medium">{p.platform}</td>
                  <td className="text-right font-mono">{fmtINR(p.spend)}</td>
                  <td className="text-right font-mono">{fmtINR(p.revenue)}</td>
                  <td className="text-right font-mono">{fmtNum(p.leads)}</td>
                  <td className="text-right font-mono">{fmtNum(p.customers)}</td>
                  <td className="text-right font-mono">{fmtINR(p.cac)}</td>
                  <td className={`text-right font-mono ${p.roas >= 1 ? "text-emerald-700" : "text-rose-700"}`}>{p.roas.toFixed(2)}×</td>
                </tr>
              ))}
              {d.byPlatform.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-ink-500 py-6">
                    No platform data yet — connect Meta/Google or upload lead sources to see channel attribution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Experiments ROI */}
      <SectionHeader
        title="Experiment impact"
        description="Bayesian-detected winners and their estimated revenue uplift"
      />
      {d.byExperiment.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500 text-center py-8">
            No running or completed experiments. Plan one in the <Link href="/app/experiments" className="text-brand-600 hover:underline">Experiments dashboard</Link>.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {d.byExperiment.map((e) => (
            <Link key={e.experimentId} href={`/app/experiments/${e.experimentId}`}>
              <Card hover>
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-ink-900">{e.title}</div>
                  <Badge variant={e.status === "RUNNING" ? "brand" : e.status === "COMPLETED" ? "success" : "neutral"}>
                    {e.status}
                  </Badge>
                </div>
                {e.winnerLabel ? (
                  <div className="mt-2 text-xs">
                    <Badge variant="success">Winner: {e.winnerLabel}</Badge>{" "}
                    {e.incrementalRevenueEstimate !== null && (
                      <span className="font-mono text-emerald-700">
                        est. +{fmtINR(e.incrementalRevenueEstimate)} uplift
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-ink-500 mt-2">No winner detected yet</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
