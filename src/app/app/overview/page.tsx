import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fmtINR, fmtNum, fmtPct, ctr, cpl, roas } from "@/lib/format";
import { isOperatorRole } from "./_lib";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { Sparkline, LineChart, BarChart, DonutChart, FunnelChart } from "../_components/charts";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: { range?: string } }) {
  const session = await requireSession();
  const range = searchParams.range ?? "30";
  const days = Math.min(Math.max(parseInt(range, 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400_000);

  const operator = isOperatorRole(session.role);

  const [campaigns, leads, customers, requests, tasks, integrations, recentDecisions, activeClients, allCampaigns] = await Promise.all([
    prisma.campaign.findMany({ where: { orgId: session.orgId, ...(operator ? {} : { client: { orgId: session.orgId } }) } }),
    prisma.lead.findMany({ where: { orgId: session.orgId, createdAt: { gte: since } } }),
    prisma.customer.findMany({ where: { orgId: session.orgId, acquiredAt: { gte: since } } }),
    prisma.clientRequest.findMany({ where: { orgId: session.orgId } }),
    prisma.task.findMany({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.decisionLog.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.client.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.campaign.findMany({ where: { orgId: session.orgId } })
  ]);

  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(l.status)).length;
  const totalCustomers = customers.length;
  const cac = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
  const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const overallConv = totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : 0;

  // Funnel
  const funnel = [
    { label: "Impressions", value: campaigns.reduce((s, c) => s + Number(c.impressions), 0) },
    { label: "Clicks",      value: campaigns.reduce((s, c) => s + Number(c.clicks), 0) },
    { label: "Leads",       value: totalLeads },
    { label: "Qualified",   value: qualifiedLeads },
    { label: "Customers",   value: totalCustomers }
  ];

  // Top campaigns
  const topByCPL = [...campaigns]
    .filter((c) => Number(c.leads) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spend: c.spent,
      leads: Number(c.leads),
      cpl: c.spent / Number(c.leads)
    }))
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 5);

  // Daily leads chart (last 14 days)
  const daily = new Map<string, number>();
  for (let i = 13; i >= 0; i--) daily.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    if (daily.has(d)) daily.set(d, daily.get(d)! + 1);
  }
  const chartData = Array.from(daily.entries()).map(([d, v]) => ({ label: d.slice(5), value: v }));
  const leadValues = chartData.map((d) => d.value);

  // Daily spend chart (last 14 days)
  const dailySpend = new Map<string, number>();
  for (let i = 13; i >= 0; i--) dailySpend.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  // Use AdSpend records
  const adSpends = await prisma.adSpend.findMany({ where: { orgId: session.orgId, date: { gte: new Date(Date.now() - 14 * 86400_000) } } });
  for (const s of adSpends) {
    const d = s.date.toISOString().slice(0, 10);
    if (dailySpend.has(d)) dailySpend.set(d, dailySpend.get(d)! + s.amount);
  }
  const spendValues = Array.from(dailySpend.entries()).map(([d, v]) => ({ label: d.slice(5), value: v }));
  const spendSparkValues = Array.from(dailySpend.values());

  // Alerts
  const alerts = campaigns
    .filter((c) => c.health === "At Risk" || c.health === "Critical" || (c.spent > 0 && c.budget && c.spent / c.budget > 0.95))
    .map((c) => ({
      kind: "warning" as const,
      title: `${c.name} - needs attention`,
      desc: c.health === "Critical" ? "Critical: campaign performance degraded" : c.spent / (c.budget || 1) > 0.95 ? "Budget over 95% utilized" : "Performance below expected"
    }));

  const failedIntegrations = integrations.filter((i) => i.status === "FAILED" || i.status === "DEGRADED");

  // Donut: leads by source
  const sourceCounts: Record<string, number> = {};
  for (const l of leads) sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1;
  const sourceDonut = Object.entries(sourceCounts).map(([s, v], i) => ({
    label: s.replace(/_/g, " "),
    value: v,
    color: ["#365efb", "#d946ef", "#10b981", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"][i % 7]
  }));

  // Bar: platforms by spend
  const platformSpend: Record<string, number> = {};
  for (const c of campaigns) platformSpend[c.platform] = (platformSpend[c.platform] ?? 0) + c.spent;
  const platformBars = Object.entries(platformSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([p, v]) => ({ label: p, value: v }));

  // X-axis labels for line chart
  const xLabels = Array.from(daily.keys()).map((d) => d.slice(5));

  // Line chart data: leads + spend
  const lineSeries = [
    { name: "Leads", color: "#365efb", data: leadValues },
    { name: "Spend", color: "#d946ef", data: spendValues.map((d) => Math.round(d.value / 100)) } // scaled
  ];

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Overview"
        subtitle="Marketing command center - what is happening across every channel right now."
        right={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Range:</span>
            {[["7", "7d"], ["30", "30d"], ["90", "90d"]].map(([k, l]) => (
              <Link
                key={k}
                href={`/app/overview?range=${k}`}
                className={`px-2 py-1 rounded ${days === Number(k) ? "bg-brand-600 text-white" : "bg-ink-100 hover:bg-ink-200 text-ink-700"}`}
              >
                {l}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPIs with sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ad Spend"
          value={fmtINR(totalSpend)}
          sub={`${campaigns.filter((c) => c.status === "ACTIVE").length} active campaigns`}
          sparkData={spendSparkValues}
          trend="neutral"
        />
        <KpiCard
          label="Leads"
          value={fmtNum(totalLeads)}
          sub={`${qualifiedLeads} qualified`}
          sparkData={leadValues}
          trend="up-good"
        />
        <KpiCard
          label="CPL"
          value={fmtINR(overallCpl)}
          sub="Cost per lead"
          sparkData={spendValues.map((d, i) => leadValues[i] > 0 ? Math.round(d.value / leadValues[i]) : 0)}
          trend="down-good"
        />
        <KpiCard
          label="Customers"
          value={fmtNum(totalCustomers)}
          sub={`CAC ${fmtINR(cac)}`}
          sparkData={leadValues.map((_, i) => Math.round(leadValues[i] * (overallConv / 100)))}
          trend="up-good"
        />
        <KpiCard
          label="Revenue"
          value={fmtINR(totalRevenue)}
          sub={`ROAS ${overallRoas.toFixed(2)}x`}
          sparkData={spendValues.map((d) => Math.round(d.value * overallRoas))}
          trend="up-good"
        />
        <KpiCard
          label="Conv. rate"
          value={fmtPct(overallConv)}
          sub="Lead to Customer"
        />
        <KpiCard
          label="Active Clients"
          value={fmtNum(activeClients)}
          sub="On platform"
        />
        <KpiCard
          label="Open Requests"
          value={fmtNum(requests.filter((r) => !["RESOLVED", "CLOSED"].includes(r.status)).length)}
          sub="Pending action"
        />
      </div>

      {/* Alerts + integrations */}
      {(alerts.length > 0 || failedIntegrations.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-700">Campaign health alerts</h3>
              {alerts.map((a, i) => (
                <div key={i} className="card p-4 border-l-4 border-amber-500">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-sm text-ink-600 mt-1">{a.desc}</div>
                </div>
              ))}
            </div>
          )}
          {failedIntegrations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-700">Integration status</h3>
              {failedIntegrations.map((i) => (
                <div key={i.id} className="card p-4 border-l-4 border-amber-500">
                  <div className="font-semibold">{i.provider}</div>
                  <div className="text-sm text-ink-600 mt-1">{i.errorMessage ?? "Performance degraded - investigate."}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trends chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-700">Daily leads vs spend (last 14 days)</h3>
          <Link href="/app/analytics" className="text-xs text-brand-600 hover:underline">Open analytics</Link>
        </div>
        <LineChart series={lineSeries} xLabels={xLabels} height={200} yFormat={(v: number) => fmtNum(v)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Acquisition funnel</h3>
          <FunnelChart stages={funnel} />
        </div>

        {/* Source donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Leads by source</h3>
          {sourceDonut.length > 0 ? <DonutChart data={sourceDonut} size={140} /> : <p className="text-sm text-ink-500">No data</p>}
        </div>

        {/* Platform bars */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Spend by platform</h3>
          <BarChart data={platformBars} height={160} formatValue={(v) => fmtINR(v)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top campaigns */}
        <TopListCard
          title="Top campaigns by CPL"
          items={topByCPL.map((c) => ({
            href: `/app/campaigns/${c.id}`,
            title: c.name,
            subtitle: `${c.platform} - ${c.status}`,
            value: `${fmtINR(c.cpl)} CPL - ${fmtNum(c.leads)} leads`
          }))}
          footerLink={{ href: "/app/campaigns", label: "All campaigns" }}
        />

        {/* Recent decisions */}
        <TopListCard
          title="Recent marketing decisions"
          items={recentDecisions.map((d) => ({
            href: `/app/decisions/${d.id}`,
            title: `${d.decisionType.replace(/_/g, " ")} - ${d.decision.slice(0, 60)}`,
            subtitle: d.reason.slice(0, 80),
            value: d.evaluation ?? "Tracked"
          }))}
          footerLink={{ href: "/app/decisions", label: "Decision log" }}
        />

        {/* Notifications */}
        <TopListCard
          title="Notifications"
          items={[
            {
              href: "/app/notifications",
              title: "12 new qualified leads this week",
              subtitle: "Acme Realty, Dubai campaign",
              value: "marketing"
            },
            {
              href: "/app/notifications",
              title: "Google campaign CPL rising",
              subtitle: "+22% vs 7-day avg",
              value: "performance"
            }
          ]}
          footerLink={{ href: "/app/notifications", label: "All notifications" }}
        />
      </div>

      {/* Open tasks & requests */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Open tasks</h3>
            <Link href="/app/tasks" className="text-xs text-brand-600 hover:underline">All</Link>
          </div>
          {tasks.length === 0 && <p className="text-sm text-ink-500">No open tasks.</p>}
          <ul className="divide-y divide-ink-100">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="py-2 text-sm">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-ink-500 mt-0.5">{t.priority} - due {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "-"}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Open client requests</h3>
            <Link href="/app/requests" className="text-xs text-brand-600 hover:underline">All</Link>
          </div>
          {requests.length === 0 && <p className="text-sm text-ink-500">No open requests.</p>}
          <ul className="divide-y divide-ink-100">
            {requests.slice(0, 6).map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{r.title}</div>
                  <span className={`badge ${r.priority === "URGENT" ? "badge-danger" : r.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{r.priority}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5">{r.status} - {r.category.replace(/_/g, " ")}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, sparkData, trend }: { label: string; value: string; sub?: string; sparkData?: number[]; trend?: "up-good" | "down-good" | "neutral" }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && (
        <div className={`kpi-trend ${trend === "up-good" ? "text-emerald-600" : trend === "down-good" ? "text-emerald-600" : ""}`}>{sub}</div>
      )}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute right-3 bottom-3 opacity-50">
          <Sparkline data={sparkData} width={70} height={20} fill={false} color={trend === "up-good" ? "#10b981" : trend === "down-good" ? "#f59e0b" : "#365efb"} />
        </div>
      )}
    </div>
  );
}

function TopListCard({
  title,
  items,
  footerLink
}: {
  title: string;
  items: Array<{ href: string; title: string; subtitle: string; value: string }>;
  footerLink?: { href: string; label: string };
}) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-700 mb-3">{title}</h3>
      {items.length === 0 && <p className="text-sm text-ink-500">Nothing here yet.</p>}
      <ul className="divide-y divide-ink-100">
        {items.slice(0, 6).map((it) => (
          <li key={it.href} className="py-2">
            <Link href={it.href} className="block hover:bg-ink-50 -mx-2 px-2 rounded transition-colors">
              <div className="text-sm font-medium truncate">{it.title}</div>
              <div className="text-xs text-ink-500 truncate">{it.subtitle}</div>
              <div className="text-xs text-brand-600 font-medium mt-0.5">{it.value}</div>
            </Link>
          </li>
        ))}
      </ul>
      {footerLink && (
        <div className="mt-3 pt-3 border-t border-ink-100 text-xs">
          <Link href={footerLink.href} className="text-brand-600 hover:underline">{footerLink.label}</Link>
        </div>
      )}
    </div>
  );
}