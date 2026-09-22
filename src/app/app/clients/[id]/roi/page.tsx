// Adziga — /app/clients/[id]/roi
// Sprint 7a — per-client ROI deep dive.
// Adds a waterfall chart, channel breakdown table, experiments ROI list.

import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ROIService } from "@/server/services/roi-service";
import { PageHeader } from "../../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../../_components/ui";
import { FunnelChart, LineChart } from "../../../_components/charts";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [30, 60, 90, 180] as const;

export default async function ClientRoiPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { days?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 60;

  let r;
  try {
    r = await ROIService.clientRoiReport(session.orgId, params.id, days);
  } catch {
    notFound();
  }

  const ts = r.timeSeries;
  const xLabels = ts.map((p) => p.date.slice(5));
  const series = [
    { name: "Revenue", color: "#10b981", data: ts.map((p) => p.revenue) },
    { name: "Spend", color: "#ef4444", data: ts.map((p) => p.spend) }
  ];

  // Waterfall stages: any stage with value > 0 becomes a Funnel row.
  const wf = r.waterfall;
  const stageBlock: Array<{ label: string; value: number }> = [];
  if (wf.impressions > 0) stageBlock.push({ label: "Impressions", value: wf.impressions });
  if (wf.clicks > 0) stageBlock.push({ label: "Clicks", value: wf.clicks });
  if (wf.visits > 0) stageBlock.push({ label: "Visits", value: wf.visits });
  if (wf.leads > 0) stageBlock.push({ label: "Leads", value: wf.leads });
  if (wf.qualified > 0) stageBlock.push({ label: "Qualified", value: wf.qualified });
  if (wf.customers > 0) stageBlock.push({ label: "Customers", value: wf.customers });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${r.client.businessName} — ROI`}
        subtitle={`Last ${days} days · ${r.client.industry ?? "—"} · ${r.client.tier ?? "—"}`}
        breadcrumbs={[
          { label: "Clients", href: "/app/clients" },
          { label: r.client.businessName, href: `/app/clients/${params.id}` },
          { label: "ROI" }
        ]}
        right={
          <div className="flex items-center gap-2">
            <Badge variant={r.kpis.roas >= 1 ? "success" : "accent"}>
              {r.kpis.roas.toFixed(2)}× ROAS
            </Badge>
            {r.kpis.ltvEstimate > 0 && (
              <Badge variant="info">
                LTV est. {fmtINR(r.kpis.ltvEstimate)}
                {r.kpis.ltvCacRatio > 0 && ` · ${r.kpis.ltvCacRatio.toFixed(1)}× LTV/CAC`}
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Window:</span>
        {DAY_OPTIONS.map((d) => (
          <Link
            key={d}
            href={`?days=${d}`}
            className={`px-3 py-1 rounded-md ${
              d === days ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {d}d
          </Link>
        ))}
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue" value={fmtINR(r.kpis.totalRevenue)} tone="success" />
        <Kpi label="Spend" value={fmtINR(r.kpis.totalSpend)} />
        <Kpi
          label="Net ROI"
          value={fmtINR(r.kpis.netRoi)}
          tone={r.kpis.netRoi >= 0 ? "success" : "accent"}
          hint={`ROAS ${r.kpis.roas.toFixed(2)}×`}
        />
        <Kpi label="CAC" value={fmtINR(r.kpis.cac)} hint={`${r.kpis.totalCustomers} customers`} />
        <Kpi label="Avg deal" value={fmtINR(r.kpis.avgDealSize)} />
        <Kpi label="Leads" value={fmtNum(r.kpis.totalLeads)} hint={`${fmtPct(r.kpis.qualifiedRate, 1)} qualified`} />
        <Kpi label="Qualified" value={fmtNum(r.kpis.totalQualified)} />
        <Kpi label="Customer rate" value={fmtPct(r.kpis.customerRate, 1)} hint="wins / leads" />
        <Kpi
          label="LTV/CAC"
          value={r.kpis.ltvCacRatio > 0 ? `${r.kpis.ltvCacRatio.toFixed(2)}×` : "—"}
          hint={r.kpis.ltvCacRatio >= 3 ? "Healthy" : r.kpis.ltvCacRatio >= 1 ? "Marginal" : "Below 1×"}
          tone={r.kpis.ltvCacRatio >= 3 ? "success" : r.kpis.ltvCacRatio >= 1 ? "neutral" : "accent"}
        />
        <Kpi
          label="Months to payback"
          value={r.kpis.monthsToPayback > 0 && r.kpis.monthsToPayback < 120 ? r.kpis.monthsToPayback.toFixed(1) : "—"}
          hint="at repeat rate 1.0/month"
        />
      </div>

      {/* Alerts */}
      {r.alerts.length > 0 && (
        <Card>
          <ul className="space-y-1 text-xs">
            {r.alerts.map((a, i) => (
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

      {/* Waterfall */}
      <SectionHeader title="Funnel" description="Top of funnel → customer. Impressions stay 0 until Meta/Google sync lands." />
      <Card>
        {stageBlock.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-8">
            No funnel data yet for this client.
          </p>
        ) : (
          <FunnelChart stages={stageBlock} />
        )}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {wf.leadConversionRate > 0 && (
            <RatePill label="Visit→Lead" value={wf.leadConversionRate} />
          )}
          <RatePill label="Lead→Qualified" value={wf.qualificationRate} />
          <RatePill label="Qualified→Customer" value={wf.winRate} />
          <RatePill label="Lead→Customer" value={wf.customerConversionRate} />
        </div>
      </Card>

      {/* Time series */}
      <SectionHeader title="Daily revenue vs spend" description="Click the channels tab for attribution breakdown" />
      <Card>
        <div className="overflow-x-auto">
          <LineChart series={series} xLabels={xLabels} height={220} width={900} />
        </div>
      </Card>

      {/* By channel */}
      <SectionHeader title="By channel" description="Spend, revenue, ROAS per platform" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200">
              <tr>
                <th className="text-left py-2">Platform</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Qualified</th>
                <th className="text-right">Customers</th>
                <th className="text-right">CAC</th>
                <th className="text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {r.byChannel.map((c) => (
                <tr key={c.platform} className="border-b border-ink-100">
                  <td className="py-2 font-medium">{c.platform}</td>
                  <td className="text-right font-mono">{fmtINR(c.spend)}</td>
                  <td className="text-right font-mono">{fmtINR(c.revenue)}</td>
                  <td className="text-right font-mono">{fmtNum(c.leads)}</td>
                  <td className="text-right font-mono">{fmtNum(c.qualified)}</td>
                  <td className="text-right font-mono">{fmtNum(c.customers)}</td>
                  <td className="text-right font-mono">{fmtINR(c.cac)}</td>
                  <td className={`text-right font-mono ${c.roas >= 1 ? "text-emerald-700" : c.revenue > 0 ? "text-rose-700" : "text-ink-500"}`}>
                    {c.spend > 0 ? `${c.roas.toFixed(2)}×` : "—"}
                  </td>
                </tr>
              ))}
              {r.byChannel.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-ink-500 py-6">
                    No channel attribution yet. Connect campaign sources to see ROAS per platform.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Experiment ROI */}
      <SectionHeader title="Experiments" description="Estimated uplift from each completed/running test" />
      {r.experiments.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500 text-center py-6">
            No experiments yet for {r.client.businessName}. <Link href="/app/experiments" className="text-brand-600 hover:underline">Plan one →</Link>
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {r.experiments.map((e) => (
            <Link key={e.experimentId} href={`/app/experiments/${e.experimentId}`}>
              <Card hover>
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-ink-900 truncate">{e.title}</div>
                  <Badge variant={e.status === "RUNNING" ? "brand" : e.status === "COMPLETED" ? "success" : "neutral"}>
                    {e.status}
                  </Badge>
                </div>
                <div className="mt-2 text-xs space-y-1">
                  {e.variantMetrics.map((v) => (
                    <div key={v.variantId} className="flex justify-between">
                      <span className={`${v.kind === "CONTROL" ? "text-ink-700" : "text-brand-700"}`}>
                        {v.label}
                        {v.variantId === e.winnerVariantId && " ★"}
                      </span>
                      <span className="font-mono text-ink-700">
                        {v.converted}/{v.assigned} ({(v.conversionRate * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
                {e.winnerLabel && e.incrementalRevenueEstimate !== null && (
                  <div className="mt-2 text-xs">
                    <span className="text-emerald-700 font-mono">
                      est. +{fmtINR(e.incrementalRevenueEstimate)} incremental
                    </span>
                  </div>
                )}
                {e.winnerLabel && e.incrementalRevenueEstimate === null && (
                  <div className="mt-2 text-xs text-ink-500">Winner ready but no revenue attributed yet.</div>
                )}
                {!e.winnerLabel && e.sampleSizeMet && (
                  <div className="mt-2 text-xs">
                    <Link href={`/app/experiments/${e.experimentId}`} className="text-brand-600 hover:underline">
                      Declare winner →
                    </Link>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RatePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ink-50 px-3 py-2">
      <div className="text-ink-500">{label}</div>
      <div className="font-semibold font-mono text-ink-900">{fmtPct(value, 1)}</div>
    </div>
  );
}
