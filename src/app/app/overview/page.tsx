import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fmtINR, fmtNum, fmtPct, ctr, cpl, roas } from "@/lib/format";
import { isOperatorRole } from "./_lib";
import { PageHeader } from "../_components/page-header";
import { KpiCard, AlertCard, FunnelCard, TopListCard, ChartBars } from "../_components/widgets";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: { range?: string } }) {
  const session = await requireSession();
  const range = searchParams.range ?? "30";
  const days = Math.min(Math.max(parseInt(range, 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400_000);

  const operator = isOperatorRole(session.role);

  // Aggregates
  const [campaigns, leads, customers, requests, tasks, integrations, notifications, recentDecisions, activeClients] = await Promise.all([
    prisma.campaign.findMany({ where: { orgId: session.orgId, ...(operator ? {} : { client: { orgId: session.orgId } }) } }),
    prisma.lead.findMany({
      where: { orgId: session.orgId, createdAt: { gte: since } },
      include: { client: true, campaign: true }
    }),
    prisma.customer.findMany({
      where: { orgId: session.orgId, acquiredAt: { gte: since } }
    }),
    prisma.clientRequest.findMany({ where: { orgId: session.orgId } }),
    prisma.task.findMany({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.notification.findMany({ where: { userId: session.userId, read: false }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.decisionLog.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.client.count({ where: { orgId: session.orgId, status: "ACTIVE" } })
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
  const funnel = {
    impressions: campaigns.reduce((s, c) => s + Number(c.impressions), 0),
    clicks: campaigns.reduce((s, c) => s + Number(c.clicks), 0),
    leads: totalLeads,
    qualified: qualifiedLeads,
    customers: totalCustomers
  };

  // Top campaigns
  const topByCPL = [...campaigns]
    .filter((c) => Number(c.leads) > 0)
    .map((c) => ({ id: c.id, name: c.name, platform: c.platform, status: c.status, spend: c.spent, leads: Number(c.leads), cpl: c.spent / Number(c.leads) }))
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 5);

  // Daily leads chart (last 14 days)
  const dailyLeads = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    dailyLeads.set(d, 0);
  }
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    if (dailyLeads.has(d)) dailyLeads.set(d, dailyLeads.get(d)! + 1);
  }
  const chart = Array.from(dailyLeads.entries()).map(([date, count]) => ({ label: date.slice(5), value: count }));

  // Alerts
  const alerts = campaigns
    .filter((c) => c.health === "At Risk" || c.health === "Critical" || (c.spent > 0 && c.budget && c.spent / c.budget > 0.95))
    .map((c) => ({
      kind: "warning" as const,
      title: `${c.name} — needs attention`,
      desc: c.health === "Critical" ? "Critical: campaign performance degraded" : c.spent / (c.budget || 1) > 0.95 ? "Budget over 95% utilized" : "Performance below expected"
    }));

  const failedIntegrations = integrations.filter((i) => i.status === "FAILED" || i.status === "DEGRADED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Marketing command center — what's happening across every channel right now."
        right={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Range:</span>
            {[
              ["7", "7d"], ["30", "30d"], ["90", "90d"]
            ].map(([k, l]) => (
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ad Spend"     value={fmtINR(totalSpend)}    sub={`${campaigns.filter((c) => c.status === "ACTIVE").length} active campaigns`} />
        <KpiCard label="Leads"        value={fmtNum(totalLeads)}    sub={`${qualifiedLeads} qualified`} />
        <KpiCard label="CPL"          value={fmtINR(overallCpl)}    sub="Cost per lead" trend="down-good" />
        <KpiCard label="Customers"    value={fmtNum(totalCustomers)} sub={`CAC ${fmtINR(cac)}`} />
        <KpiCard label="Revenue"      value={fmtINR(totalRevenue)}  sub={`ROAS ${overallRoas.toFixed(2)}x`} trend="up-good" />
        <KpiCard label="Conv. rate"   value={fmtPct(overallConv)}   sub="Lead → Customer" />
        <KpiCard label="Active Clients" value={fmtNum(activeClients)} sub="On platform" />
        <KpiCard label="Open Requests" value={fmtNum(requests.filter((r) => !["RESOLVED", "CLOSED"].includes(r.status)).length)} sub="Pending action" />
      </div>

      {/* Alerts + integrations */}
      {(alerts.length > 0 || failedIntegrations.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-700">Campaign health alerts</h3>
              {alerts.map((a, i) => <AlertCard key={i} {...a} />)}
            </div>
          )}
          {failedIntegrations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-700">Integration status</h3>
              {failedIntegrations.map((i) => (
                <div key={i.id} className="card p-4 border-l-4 border-amber-500">
                  <div className="font-semibold">{i.provider}</div>
                  <div className="text-sm text-ink-600 mt-1">{i.errorMessage ?? "Performance degraded — investigate."}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <FunnelCard data={[
          { label: "Impressions", value: funnel.impressions, fmt: fmtNum },
          { label: "Clicks",      value: funnel.clicks,      fmt: fmtNum },
          { label: "Leads",       value: funnel.leads,       fmt: fmtNum },
          { label: "Qualified",   value: funnel.qualified,   fmt: fmtNum },
          { label: "Customers",   value: funnel.customers,   fmt: fmtNum }
        ]} />

        {/* Daily leads */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Lead intake — last 14 days</h3>
            <Link href="/app/analytics" className="text-xs text-brand-600 hover:underline">Open analytics →</Link>
          </div>
          <ChartBars data={chart} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top campaigns by CPL */}
        <TopListCard
          title="Top campaigns by CPL"
          items={topByCPL.map((c) => ({
            href: `/app/campaigns/${c.id}`,
            title: c.name,
            subtitle: `${c.platform} · ${c.status}`,
            value: `${fmtINR(c.cpl)} CPL · ${fmtNum(c.leads)} leads`
          }))}
          footerLink={{ href: "/app/campaigns", label: "All campaigns →" }}
        />

        {/* Recent decisions */}
        <TopListCard
          title="Recent marketing decisions"
          items={recentDecisions.map((d) => ({
            href: `/app/decisions/${d.id}`,
            title: `${d.decisionType.replace(/_/g, " ")} — ${d.decision.slice(0, 60)}`,
            subtitle: d.reason.slice(0, 80),
            value: d.evaluation ?? "Tracked"
          }))}
          footerLink={{ href: "/app/decisions", label: "Decision log →" }}
        />

        {/* Notifications */}
        <TopListCard
          title="Notifications"
          items={notifications.map((n) => ({
            href: n.link ?? "/app/notifications",
            title: n.title,
            subtitle: n.message,
            value: n.type.replace(/_/g, " ")
          }))}
          footerLink={{ href: "/app/notifications", label: "All notifications →" }}
        />
      </div>

      {/* Open tasks & requests */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Open tasks</h3>
            <Link href="/app/tasks" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          {tasks.length === 0 && <p className="text-sm text-ink-500">No open tasks. ✨</p>}
          <ul className="divide-y divide-ink-100">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="py-2 text-sm">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-ink-500 mt-0.5">{t.priority} · due {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—"}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Open client requests</h3>
            <Link href="/app/requests" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          {requests.length === 0 && <p className="text-sm text-ink-500">No open requests.</p>}
          <ul className="divide-y divide-ink-100">
            {requests.slice(0, 6).map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{r.title}</div>
                  <span className={`badge ${r.priority === "URGENT" ? "badge-danger" : r.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{r.priority}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5">{r.status} · {r.category.replace(/_/g, " ")}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}