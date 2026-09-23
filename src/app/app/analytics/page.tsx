import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { KpiCard, ChartBars } from "../_components/widgets";
import { fmtINR, fmtNum, fmtPct, ctr, cpl, roas } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string; clientId?: string } }) {
  const session = await requireSession();
  const days = Math.min(Math.max(parseInt(searchParams.range ?? "30", 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400_000);
  const prevSince = new Date(Date.now() - days * 2 * 86400_000);

  const where: any = { orgId: session.orgId, createdAt: { gte: since } };
  if (searchParams.clientId) where.clientId = searchParams.clientId;

  const [campaigns, leads, customers, revenue, clients] = await Promise.all([
    prisma.campaign.findMany({ where: { orgId: session.orgId } }),
    prisma.lead.findMany({ where }),
    prisma.customer.findMany({ where: { orgId: session.orgId, acquiredAt: { gte: since } } }),
    prisma.revenue.findMany({ where: { orgId: session.orgId, recordedAt: { gte: since } } }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  // Aggregates
  const spend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + Number(c.impressions), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.clicks), 0);
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(l.status)).length;
  const totalCustomers = customers.length;
  const ctrPct = ctr(totalClicks, totalImpressions);
  const cpl_ = cpl(spend, totalLeads);
  const cac_ = totalCustomers ? spend / totalCustomers : 0;
  const roas_ = spend > 0 ? totalRevenue / spend : 0;

  // Per-platform breakdown
  const byPlatform: Record<string, any> = {};
  for (const c of campaigns) {
    if (!byPlatform[c.platform]) byPlatform[c.platform] = { spend: 0, leads: 0, customers: 0, revenue: 0, impressions: 0, clicks: 0 };
    byPlatform[c.platform].spend += c.spent;
    byPlatform[c.platform].leads += Number(c.leads);
    byPlatform[c.platform].customers += Number(c.customers);
    byPlatform[c.platform].revenue += c.revenue;
    byPlatform[c.platform].impressions += Number(c.impressions);
    byPlatform[c.platform].clicks += Number(c.clicks);
  }

  // Per-source lead breakdown
  const bySource: Record<string, number> = {};
  for (const l of leads) {
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
  }

  // Daily leads chart (14 days)
  const daily = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    daily.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  }
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    if (daily.has(d)) daily.set(d, daily.get(d)! + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Unified marketing data model. Platform metrics  Business metrics. Compare periods, channels, and sources."
        right={
          <div className="flex items-center gap-2 text-xs">
            <Link href="/app/analytics/roi" className="px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700">
              ROI dashboard
            </Link>
            <Link href="/app/analytics/anomalies" className="px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">
              Anomalies
            </Link>
            <Link href="/app/analytics/conversion-lag" className="px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">
              Conversion lag
            </Link>
            <Link href="/app/analytics/ltv" className="px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">
              Customer LTV
            </Link>
            <Link href="/app/analytics/calibration" className="px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">
              Calibration
            </Link>
            <span className="text-ink-500">Range:</span>
            {[["7", "7d"], ["30", "30d"], ["90", "90d"]].map(([k, l]) => (
              <Link key={k} href={`/app/analytics?range=${k}`} className={`px-2 py-1 rounded ${days === Number(k) ? "bg-brand-600 text-white" : "bg-ink-100 hover:bg-ink-200"}`}>{l}</Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Spend" value={fmtINR(spend)} sub={`${campaigns.length} campaigns`} />
        <KpiCard label="Impressions" value={fmtNum(totalImpressions)} sub={`Reach ${fmtNum(campaigns.reduce((s, c) => s + Number(c.reach), 0))}`} />
        <KpiCard label="CTR" value={fmtPct(ctrPct)} sub={`${fmtNum(totalClicks)} clicks`} />
        <KpiCard label="CPL" value={fmtINR(cpl_)} sub={`${fmtNum(totalLeads)} leads`} />
        <KpiCard label="Qualified leads" value={fmtNum(qualifiedLeads)} sub={`${fmtPct((qualifiedLeads / (totalLeads || 1)) * 100)} of leads`} />
        <KpiCard label="CAC" value={fmtINR(cac_)} sub={`${fmtNum(totalCustomers)} customers`} />
        <KpiCard label="Revenue" value={fmtINR(totalRevenue)} sub="From converted customers" />
        <KpiCard label="ROAS" value={`${roas_.toFixed(2)}x`} sub="Return on ad spend" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Daily lead intake (last 14 days)</h3>
          <ChartBars data={Array.from(daily.entries()).map(([d, v]) => ({ label: d.slice(5), value: v }))} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Leads by source</h3>
          <ul className="space-y-2">
            {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
              const max = Math.max(...Object.values(bySource));
              const pct = (count / max) * 100;
              return (
                <li key={src}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div>{src.replace(/_/g, " ")}</div>
                    <div className="font-mono">{count}</div>
                  </div>
                  <div className="h-2 bg-ink-100 rounded">
                    <div className="h-2 rounded bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">By platform</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Platform</th>
              <th className="text-right">Spend</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Leads</th>
              <th className="text-right">CPL</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byPlatform).map(([p, d]) => (
              <tr key={p}>
                <td><span className="badge badge-neutral">{PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p}</span></td>
                <td className="text-right font-mono text-xs">{fmtINR(d.spend)}</td>
                <td className="text-right font-mono text-xs">{fmtNum(d.impressions)}</td>
                <td className="text-right font-mono text-xs">{fmtPct(ctr(d.clicks, d.impressions))}</td>
                <td className="text-right font-mono text-xs">{fmtNum(d.leads)}</td>
                <td className="text-right font-mono text-xs">{fmtINR(cpl(d.spend, d.leads))}</td>
                <td className="text-right font-mono text-xs">{fmtINR(d.revenue)}</td>
                <td className="text-right font-mono text-xs">{d.spend > 0 ? `${roas(d.revenue, d.spend).toFixed(2)}x` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}