import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { isOperatorRole } from "./_lib";
import { WebhookHealthService } from "@/server/services/webhook-health";
import { AgentCostAlertService } from "@/server/services/agent-cost";
import { SystemAlertsTile } from "./_system-alerts-tile";
import { PageHeader } from "../_components/page-header";
import { Sparkline, LineChart, BarChart, DonutChart, FunnelChart } from "../_components/charts";
import { EmptyState } from "../_components/empty-state";
import { ActivityFeed } from "../_components/activity-feed";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: { range?: string } }) {
  const session = await requireSession();
  const range = searchParams.range ?? "30";
  const days = Math.min(Math.max(parseInt(range, 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400_000);

  const operator = isOperatorRole(session.role);

  const [campaigns, leads, customers, requests, tasks, integrations, recentDecisions, activeClients, adSpends] = await Promise.all([
    prisma.campaign.findMany({ where: { orgId: session.orgId, ...(operator ? {} : { client: { orgId: session.orgId } }) } }),
    prisma.lead.findMany({ where: { orgId: session.orgId, createdAt: { gte: since } } }),
    prisma.customer.findMany({ where: { orgId: session.orgId, acquiredAt: { gte: since } } }),
    prisma.clientRequest.findMany({ where: { orgId: session.orgId } }),
    prisma.task.findMany({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.decisionLog.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.client.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.adSpend.findMany({ where: { orgId: session.orgId, date: { gte: new Date(Date.now() - 14 * 86400_000) } } })
  ]);

  // Sprint 8b - recent audit-log events for the live activity feed (SSR seed)
  const recentAudit = await prisma.auditLog.findMany({
    where: { orgId: session.orgId },
    orderBy: { id: "desc" },
    take: 25
  });
  const recentAuditUserIds = Array.from(new Set(recentAudit.map((a) => a.userId).filter(Boolean) as string[]));
  const recentAuditUsers = recentAuditUserIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: recentAuditUserIds } }, select: { id: true, name: true, email: true } })
    : [];
  const recentAuditUserMap = new Map(recentAuditUsers.map((u) => [u.id, u]));
  const initialActivity = recentAudit.reverse().map((e) => {
    const u = e.userId ? recentAuditUserMap.get(e.userId) : null;
    return {
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      summary: e.action.replace(/[._]/g, " "),
      userName: u?.name ?? u?.email ?? "system",
      ts: e.createdAt.toISOString()
    };
  });

  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(l.status)).length;
  const totalCustomers = customers.length;
  const cac = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
  const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const overallConv = totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const openRequests = requests.filter((r) => !["RESOLVED", "CLOSED"].includes(r.status)).length;

  // Period comparison (last period vs current period)
  const prevSince = new Date(Date.now() - 2 * days * 86400_000);
  const prevLeads = await prisma.lead.count({
    where: { orgId: session.orgId, createdAt: { gte: prevSince, lt: since } }
  });
  const leadsDelta = prevLeads > 0 ? ((totalLeads - prevLeads) / prevLeads) * 100 : 0;

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
      cpl: c.spent / Number(c.leads),
      health: c.health
    }))
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 5);

  // Daily leads + spend charts (last 14 days)
  const daily = new Map<string, number>();
  for (let i = 13; i >= 0; i--) daily.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  for (const l of leads) {
    const d = l.createdAt.toISOString().slice(0, 10);
    if (daily.has(d)) daily.set(d, daily.get(d)! + 1);
  }
  const xLabels = Array.from(daily.keys()).map((d) => d.slice(5));
  const leadValues = Array.from(daily.values());

  const dailySpend = new Map<string, number>();
  for (let i = 13; i >= 0; i--) dailySpend.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  for (const s of adSpends) {
    const d = s.date.toISOString().slice(0, 10);
    if (dailySpend.has(d)) dailySpend.set(d, dailySpend.get(d)! + s.amount);
  }
  const spendValues = Array.from(dailySpend.values());

  // Line chart data: leads + scaled spend
  const lineSeries = [
    { name: "Leads", color: "#365efb", data: leadValues },
    { name: "Spend (₹100s)", color: "#d946ef", data: spendValues.map((v) => Math.round(v / 100)) }
  ];

  // Source donut
  const sourceCounts: Record<string, number> = {};
  for (const l of leads) sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1;
  const sourceDonut = Object.entries(sourceCounts).map(([s, v], i) => ({
    label: s.replace(/_/g, " "),
    value: v,
    color: ["#365efb", "#d946ef", "#10b981", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"][i % 7]
  }));

  // Platform bars
  const platformSpend: Record<string, number> = {};
  for (const c of campaigns) platformSpend[c.platform] = (platformSpend[c.platform] ?? 0) + c.spent;
  const platformBars = Object.entries(platformSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([p, v]) => ({ label: p, value: v }));

  // Alerts
  const alerts = campaigns
    .filter((c) => c.health === "At Risk" || c.health === "Critical" || (c.spent > 0 && c.budget && c.spent / c.budget > 0.95))
    .slice(0, 3);
  const failedIntegrations = integrations.filter((i) => i.status === "FAILED" || i.status === "DEGRADED").slice(0, 3);

  // AI insights (deterministic from data)
  const insights: Array<{ kind: "warning" | "positive" | "neutral"; text: string }> = [];
  const cplByPlatform: Record<string, number[]> = {};
  for (const c of campaigns) {
    if (!cplByPlatform[c.platform]) cplByPlatform[c.platform] = [];
    if (Number(c.leads) > 0) cplByPlatform[c.platform].push(c.spent / Number(c.leads));
  }
  let bestChannel = "";
  let bestCpl = Infinity;
  let worstChannel = "";
  let worstCpl = 0;
  for (const [p, cpls] of Object.entries(cplByPlatform)) {
    const avg = cpls.reduce((a, b) => a + b, 0) / cpls.length;
    if (avg < bestCpl) { bestCpl = avg; bestChannel = p; }
    if (avg > worstCpl) { worstCpl = avg; worstChannel = p; }
  }
  if (bestChannel && worstChannel && bestChannel !== worstChannel) {
    insights.push({
      kind: "positive",
      text: `${bestChannel} leads are ${Math.round((worstCpl - bestCpl) / worstCpl * 100)}% cheaper than ${worstChannel}. Consider shifting budget.`
    });
  }
  if (activeCampaigns > 0) {
    const atRiskCount = campaigns.filter((c) => c.health === "At Risk" || c.health === "Critical").length;
    if (atRiskCount > 0) {
      insights.push({
        kind: "warning",
        text: `${atRiskCount} campaign${atRiskCount > 1 ? "s" : ""} ${atRiskCount > 1 ? "are" : "is"} below target. Review creatives before pausing.`
      });
    }
  }
  if (overallConv > 0 && overallConv < 5) {
    insights.push({
      kind: "neutral",
      text: `Lead-to-customer conversion is ${fmtPct(overallConv)}. Industry avg for your segment is 4-7%.`
    });
  } else if (overallConv >= 5) {
    insights.push({
      kind: "positive",
      text: `Conversion rate of ${fmtPct(overallConv)} is above the industry average. Your targeting is working.`
    });
  }

  // Empty-state: new org with no campaigns, no clients, no leads.
  // Show a focused "first steps" panel so users know exactly what to do.
  if (campaigns.length === 0 && activeClients === 0) {
    return (
      <div className="space-y-6 fade-in">
        <PageHeader
          title="Welcome to Adziga"
          subtitle="Let's get your marketing command center set up."
        />
        <div className="card-v0 p-8">
          <EmptyState
            illustration="campaign"
            title="Add your first client"
            description="Clients are the brands you serve. Create one (or skip if Adziga is for your own brand) and then start adding campaigns, leads, and creatives."
            primaryAction={{ label: "Add client", href: "/app/clients/new" }}
            secondaryAction={{ label: "Watch 2-min tour", href: "/docs" }}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 14.5 3 21" />
                  <path d="M14.5 9.5 21 3" />
                  <path d="M14 10 21 3 18 6 14 10z" />
                  <path d="M3 21l3-3-4.5-4.5a2.12 2.12 0 0 1 0-3l7-7a2.12 2.12 0 0 1 3 0L14.5 7" />
                  <circle cx="6" cy="18" r="1.5" />
                  <circle cx="18" cy="6" r="1.5" />
                </svg>
              ),
              tint: "from-brand-500/15 to-brand-500/0 text-brand-600",
              title: "Connect Meta, Google, WhatsApp",
              description: "Sync campaign data automatically. Tier-gated to Pro+.",
              href: "/app/admin/integrations"
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
              tint: "from-accent-500/15 to-accent-500/0 text-accent-600",
              title: "Invite your team",
              description: "Founder, Admin, Marketing Manager, Content, Sales, Finance. Audit every action.",
              href: "/app/admin"
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  <path d="M20 3v4" />
                  <path d="M22 5h-4" />
                  <path d="M4 17v2" />
                  <path d="M5 18H3" />
                </svg>
              ),
              tint: "from-amber-500/15 to-amber-500/0 text-amber-600",
              title: "Ask the AI Assistant",
              description: "Context-aware answers grounded in your actual data — not generic marketing advice.",
              href: "/app/ai"
            }
          ].map((c) => (
            <Link
              key={c.title}
              href={c.href}
              className="group relative overflow-hidden card-v0 p-5 hover:border-ink-300 hover:shadow-sm transition-all"
            >
              <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${c.tint} pointer-events-none opacity-60`} />
              <div className="relative">
                <div className={`inline-flex size-9 items-center justify-center rounded-lg bg-white/80 ring-1 ring-ink-200 ${c.tint.split(" ").pop()} mb-3`}>
                  <span className="block size-5">{c.icon}</span>
                </div>
                <h3 className="text-sm font-semibold text-ink-900 mb-1">{c.title}</h3>
                <p className="text-xs text-ink-500 leading-relaxed">{c.description}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-600 group-hover:text-ink-900 transition-colors">
                  Open
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-xs text-ink-500">
          Tip: signup creates a Founder account. Use <Link href="/app/admin" className="text-brand-600 hover:underline">Admin</Link> to invite teammates and set up billing.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <PageHeader
        title="Overview"
        subtitle={`Marketing command center · last ${days} days`}
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5 text-xs">
              {[["7", "7d"], ["30", "30d"], ["90", "90d"]].map(([k, l]) => (
                <Link
                  key={k}
                  href={`/app/overview?range=${k}`}
                  className={`px-2.5 py-1 rounded transition-colors tabular-nums ${days === Number(k) ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
            <Link href="/app/analytics" className="btn btn-secondary btn-sm hidden md:inline-flex">Export</Link>
          </div>
        }
      />

      {/* 8 KPI cards in 4-col grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ad Spend"
          value={fmtINR(totalSpend)}
          sub={`${activeCampaigns} active campaigns`}
          sparkData={spendValues}
          sparkColor="#d946ef"
        />
        <KpiCard
          label="Leads"
          value={fmtNum(totalLeads)}
          sub={`${qualifiedLeads} qualified`}
          delta={leadsDelta}
          sparkData={leadValues}
          sparkColor="#365efb"
        />
        <KpiCard
          label="Cost per Lead"
          value={fmtINR(overallCpl)}
          sub="Blended CPL"
          sparkData={leadValues.map((_, i) => spendValues[i] && leadValues[i] ? Math.round(spendValues[i] / leadValues[i]) : 0)}
          sparkColor="#f59e0b"
          invertTrend
        />
        <KpiCard
          label="ROAS"
          value={`${overallRoas.toFixed(2)}x`}
          sub={fmtINR(totalRevenue) + " revenue"}
          sparkData={spendValues.map((v) => Math.round(v * overallRoas))}
          sparkColor="#10b981"
        />
        <KpiCard
          label="Customers"
          value={fmtNum(totalCustomers)}
          sub={`CAC ${fmtINR(cac)}`}
          sparkData={leadValues.map((v) => Math.round(v * (overallConv / 100)))}
          sparkColor="#10b981"
        />
        <KpiCard
          label="Conv. Rate"
          value={fmtPct(overallConv)}
          sub="Lead → Customer"
          sparkData={leadValues.map((v, i) => Math.round(v * (overallConv / 100)))}
          sparkColor="#365efb"
        />
        <KpiCard
          label="Active Clients"
          value={fmtNum(activeClients)}
          sub="On platform"
        />
        <KpiCard
          label="Open Requests"
          value={fmtNum(openRequests)}
          sub="Pending action"
        />
      </div>

      {/* Alerts strip */}
      {(alerts.length > 0 || failedIntegrations.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {alerts.length > 0 && (
            <div className="card-v0 p-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-semibold tabular-nums">{alerts.length}</div>
                <div className="text-xs uppercase tracking-wide font-semibold text-ink-700">Campaign alerts</div>
              </div>
              <ul className="space-y-1.5">
                {alerts.map((c, i) => (
                  <li key={i} className="text-sm">
                    <Link href={`/app/campaigns/${c.id}`} className="font-medium hover:text-brand-600 transition-colors">{c.name}</Link>
                    <span className="text-ink-500"> — {c.health === "Critical" ? "critical performance drop" : c.spent / (c.budget || 1) > 0.95 ? "budget 95%+ used" : "below expected"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {failedIntegrations.length > 0 && (
            <div className="card-v0 p-4 border-l-4 border-rose-500">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 text-xs font-semibold tabular-nums">{failedIntegrations.length}</div>
                <div className="text-xs uppercase tracking-wide font-semibold text-ink-700">Integration issues</div>
              </div>
              <ul className="space-y-1.5">
                {failedIntegrations.map((i) => (
                  <li key={i.id} className="text-sm">
                    <span className="font-medium">{i.provider}</span>
                    <span className="text-ink-500"> — {i.errorMessage ?? "degraded"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Sprint 19b — system-alerts tile (webhook + cost) */}
          <SystemAlertsTile orgId={session.orgId} />
        </div>
      )}

      {/* Performance trend */}
      <div className="card-v0 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold tracking-tight">Performance trend</h3>
            <p className="text-xs text-ink-500 mt-0.5">Daily leads and spend — last 14 days</p>
          </div>
          <Link href="/app/analytics" className="text-xs text-brand-600 hover:underline">Open analytics →</Link>
        </div>
        <LineChart series={lineSeries} xLabels={xLabels} height={220} yFormat={(v: number) => fmtNum(v)} />
      </div>

      {/* Funnel + Sources + Platforms */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-v0 p-5">
          <div className="mb-4">
            <h3 className="font-semibold tracking-tight">Acquisition funnel</h3>
            <p className="text-xs text-ink-500 mt-0.5">Impressions to customers</p>
          </div>
          <FunnelChart stages={funnel} />
        </div>

        <div className="card-v0 p-5">
          <div className="mb-4">
            <h3 className="font-semibold tracking-tight">Leads by source</h3>
            <p className="text-xs text-ink-500 mt-0.5">Channel distribution</p>
          </div>
          {sourceDonut.length > 0 ? <DonutChart data={sourceDonut} size={150} /> : <p className="text-sm text-ink-500">No data</p>}
        </div>

        <div className="card-v0 p-5">
          <div className="mb-4">
            <h3 className="font-semibold tracking-tight">Spend by platform</h3>
            <p className="text-xs text-ink-500 mt-0.5">Top 6 channels</p>
          </div>
          <BarChart data={platformBars} height={180} formatValue={(v) => fmtINR(v)} />
        </div>
      </div>

      {/* Top campaigns + AI insights + Recent activity */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-v0 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold tracking-tight">Top campaigns by CPL</h3>
            <Link href="/app/campaigns" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          <ul className="space-y-2">
            {topByCPL.length === 0 && <li className="text-sm text-ink-500 py-2">No campaigns yet.</li>}
            {topByCPL.map((c) => (
              <li key={c.id}>
                <Link href={`/app/campaigns/${c.id}`} className="block px-2 py-2 -mx-2 rounded-md hover:bg-ink-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate flex-1">{c.name}</div>
                    <span className={`badge ${c.status === "ACTIVE" ? "badge-success" : c.status === "PAUSED" ? "badge-warning" : "badge-neutral"}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 tabular-nums">
                    <span>{c.platform}</span>
                    <span className="text-ink-300">·</span>
                    <span>{fmtINR(c.spend)}</span>
                    <span className="text-ink-300">·</span>
                    <span>{fmtNum(c.leads)} leads</span>
                  </div>
                  <div className="text-xs text-brand-600 font-medium mt-0.5 tabular-nums">{fmtINR(c.cpl)} CPL</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* AI insights */}
        <div className="card-v0 p-5 bg-gradient-to-br from-white to-brand-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-bento opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-6 rounded-md bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-[10px] font-bold">AI</div>
              <h3 className="font-semibold tracking-tight">Insights</h3>
            </div>
            <ul className="space-y-2.5">
              {insights.length === 0 && <li className="text-sm text-ink-500 py-2">No insights yet — need more data.</li>}
              {insights.map((ins, i) => (
                <li key={i} className="text-sm leading-relaxed pl-3 border-l-2 border-brand-300">
                  <div className="text-ink-700">{ins.text}</div>
                  <div className="flex gap-2 mt-1.5">
                    <button className="text-[10px] uppercase tracking-wide font-semibold text-brand-600 hover:underline">Apply</button>
                    <button className="text-[10px] uppercase tracking-wide font-semibold text-ink-400 hover:underline">Dismiss</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Live activity (Sprint 8b) */}
        <ActivityFeed initialEvents={initialActivity} />
      </div>

      {/* Open tasks + requests */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-v0 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold tracking-tight">Open tasks</h3>
            <Link href="/app/tasks" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          {tasks.length === 0 && <p className="text-sm text-ink-500">No open tasks.</p>}
          <ul className="space-y-1">
            {tasks.slice(0, 5).map((t) => (
              <li key={t.id} className="px-2 py-2 -mx-2 rounded-md hover:bg-ink-50 transition-colors text-sm">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 tabular-nums">
                  <span className={`badge ${t.priority === "URGENT" ? "badge-danger" : t.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{t.priority}</span>
                  <span>Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-v0 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold tracking-tight">Open client requests</h3>
            <Link href="/app/requests" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          {requests.length === 0 && <p className="text-sm text-ink-500">No open requests.</p>}
          <ul className="space-y-1">
            {requests.slice(0, 5).map((r) => (
              <li key={r.id} className="px-2 py-2 -mx-2 rounded-md hover:bg-ink-50 transition-colors text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium truncate">{r.title}</div>
                  <span className={`badge shrink-0 ${r.priority === "URGENT" ? "badge-danger" : r.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{r.priority}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5 tabular-nums">{r.status} · {r.category.replace(/_/g, " ")}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, sparkData, sparkColor = "#365efb", delta, invertTrend }: {
  label: string;
  value: string;
  sub?: string;
  sparkData?: number[];
  sparkColor?: string;
  delta?: number;
  invertTrend?: boolean;
}) {
  const deltaColor = delta === undefined ? "" :
    (invertTrend ? (delta < 0 ? "text-emerald-600" : "text-rose-600") : (delta > 0 ? "text-emerald-600" : "text-rose-600"));
  const deltaSign = delta !== undefined && delta > 0 ? "↑" : delta !== undefined && delta < 0 ? "↓" : "";

  return (
    <div className="card-v0 p-5 hover-overlay-host group">
      <div className="hover-overlay" />
      <div className="relative">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">{label}</div>
        <div className="flex items-baseline gap-2 mt-2">
          <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
          {delta !== undefined && delta !== 0 && (
            <div className={`text-xs font-semibold tabular-nums ${deltaColor}`}>{deltaSign} {Math.abs(delta).toFixed(1)}%</div>
          )}
        </div>
        {sub && <div className="text-xs text-ink-500 mt-1.5 tabular-nums">{sub}</div>}
        {sparkData && sparkData.length > 1 && (
          <div className="mt-3 -mb-1">
            <Sparkline data={sparkData} width={200} height={28} color={sparkColor} />
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
