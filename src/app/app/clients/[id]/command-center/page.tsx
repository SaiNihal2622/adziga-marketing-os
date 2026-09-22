// Adziga — /app/clients/[id]/command-center
// The hero page of the Marketing OS. One screen per client that answers the
// question: "Are we on track to hit the business goal?"
//
// Composes:
//   - The client's stated goal (acquisition target)
//   - Live funnel: leads → qualified → customers → revenue
//   - Per-campaign quality-adjusted leaderboard
//   - Top creative by qualified-lead rate
//   - Top channel by value-adjusted CPL
//   - Forecast against goal (linear extrapolation)

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { FunnelChart } from "@/app/app/_components/funnel-chart";
import { fmtINR, fmtNum, fmtPct, fmtRelative, fmtDate } from "@/lib/format";
import { AttributionService } from "@/server/services/attribution-service";
import { FunnelService } from "@/server/services/funnel-service";

export const dynamic = "force-dynamic";

export default async function CommandCenter({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      campaigns: {
        where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
        select: { id: true, name: true, platform: true, status: true, spent: true, budget: true, startDate: true, endDate: true }
      },
      leads: { select: { id: true, status: true, campaignId: true, convertedAt: true, revenue: true } },
      customers: { select: { id: true, revenue: true, acquiredAt: true, acquiredCampaignId: true } }
    }
  });
  if (!client) notFound();

  // Goal: prefer explicit acquisitionGoal; fall back to inference from budget.
  const contractBudget = client.monthlyBudget ?? 0;
  const inferredAvgDealSize = client.customers.length > 0
    ? client.customers.reduce((s, c) => s + c.revenue, 0) / client.customers.length
    : 50000;
  const goalUnit = client.acquisitionGoalUnit ?? "CUSTOMERS";
  const goal = client.acquisitionGoal
    ?? (inferredAvgDealSize > 0 && contractBudget > 0 ? Math.round((contractBudget * 6) / inferredAvgDealSize) : null);

  const funnelSnapshot = await FunnelService.snapshot({
    orgId: session.orgId,
    clientId: client.id,
    windowDays: 90
  });
  const leaderboard = await AttributionService.valueAdjustedCpl(session.orgId, { clientId: client.id });

  const clientLeads = client.leads;
  const clientCustomers = client.customers;
  const totalLeads = clientLeads.length;
  const qualifiedLeads = clientLeads.filter((l) => ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(l.status)).length;
  const wonCustomers = clientCustomers.length;
  const wonRevenue = clientCustomers.reduce((s, c) => s + c.revenue, 0);
  const totalSpend = client.campaigns.reduce((s, c) => s + c.spent, 0);

  // Progress calculation depends on goal unit
  const goalValue = goal ?? 0;
  let progress = 0;
  let progressActual: number | string = 0;
  let progressTarget: number | string = "—";
  if (goalUnit === "REVENUE") {
    progressActual = wonRevenue;
    progressTarget = goalValue;
    progress = goalValue > 0 ? Math.min(100, (wonRevenue / goalValue) * 100) : 0;
  } else if (goalUnit === "LEADS") {
    progressActual = totalLeads;
    progressTarget = goalValue;
    progress = goalValue > 0 ? Math.min(100, (totalLeads / goalValue) * 100) : 0;
  } else if (goalUnit === "QUALIFIED_LEADS") {
    progressActual = qualifiedLeads;
    progressTarget = goalValue;
    progress = goalValue > 0 ? Math.min(100, (qualifiedLeads / goalValue) * 100) : 0;
  } else {
    progressActual = wonCustomers;
    progressTarget = goalValue;
    progress = goalValue > 0 ? Math.min(100, (wonCustomers / goalValue) * 100) : 0;
  }
  const cac = wonCustomers > 0 ? totalSpend / wonCustomers : 0;
  const budgetUtil = contractBudget > 0 ? Math.min(100, (totalSpend / (contractBudget * 6)) * 100) : 0;

  // Top creative by leads (within client's campaigns)
  const recentCreatives = await prisma.creative.findMany({
    where: { campaign: { clientId: client.id, orgId: session.orgId } },
    include: { campaign: { select: { id: true, name: true } } },
    take: 50
  });
  const topCreative = recentCreatives
    .filter((c) => Number(c.impressions) > 0 || Number(c.leads) > 0)
    .sort((a, b) => Number(b.leads) - Number(a.leads))[0];

  // Top channel (lowest effective CPL wins)
  const topChannel = leaderboard
    .filter((c) => c.leads > 0)
    .sort((a, b) => (a.effectiveCpl ?? Infinity) - (b.effectiveCpl ?? Infinity))[0];

  // Worst channel (highest effective CPL)
  const worstChannel = leaderboard
    .filter((c) => c.leads > 0 && c.qualified > 0)
    .sort((a, b) => (b.effectiveCpl ?? 0) - (a.effectiveCpl ?? 0))[0];

  // Forecast
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const recentCustomers = clientCustomers.filter((c) => new Date(c.acquiredAt) >= thirtyDaysAgo);
  const monthlyRunRate = recentCustomers.length;
  const monthsToGoal = monthlyRunRate > 0 && goalValue > wonCustomers ? (goalValue - wonCustomers) / monthlyRunRate : null;

  return (
    <div>
      <PageHeader
        eyebrow={`${client.businessName} · Command Center`}
        title="Marketing Command Center"
        subtitle="Goal-driven view of acquisition health. The complexity of Meta + Google + WhatsApp + Influencer stays behind the scenes."
        breadcrumbs={[
          { label: "Clients", href: "/app/clients" },
          { label: client.businessName, href: `/app/clients/${client.id}` },
          { label: "Command Center" }
        ]}
        right={
          <>
            <Link href={`/app/clients/${client.id}`}><Button variant="outline">Client detail</Button></Link>
            <Link href={`/app/ai?clientId=${client.id}`}><Button>Open AI workspace</Button></Link>
          </>
        }
      />

      {/* Hero: Goal + Progress */}
      <Card padding="lg" className="mb-6 bg-gradient-to-br from-white via-white to-brand-50/40 border-brand-200/60">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold">Goal</div>
              {client.acquisitionGoal ? (
                <Badge variant="brand" dot>Stated</Badge>
              ) : (
                <Badge variant="neutral">Inferred from budget</Badge>
              )}
              {client.acquisitionGoalDeadline && (
                <span className="text-xs text-ink-500">
                  · by {fmtDate(client.acquisitionGoalDeadline)}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <h2 className="text-4xl font-semibold tracking-tighter text-ink-900 tabular-nums">
                {goalUnit === "REVENUE" ? fmtINR(Number(progressActual)) : fmtNum(Number(progressActual))}
                <span className="text-ink-400 text-2xl"> / {goalUnit === "REVENUE" ? fmtINR(Number(progressTarget)) : fmtNum(Number(progressTarget))}</span>
              </h2>
              <Badge variant={progress >= 80 ? "success" : progress >= 40 ? "brand" : "warning"} dot>
                {progress.toFixed(0)}% complete
              </Badge>
            </div>
            <p className="text-sm text-ink-500 mt-1">
              {client.acquisitionGoal
                ? `User-defined goal of ${fmtNum(Number(progressTarget))} ${goalUnit.toLowerCase().replace("_", " ")}.`
                : `Inferred from ${fmtINR(contractBudget)} monthly budget × 6 ÷ ${fmtINR(inferredAvgDealSize)} avg deal. Set a real goal in Edit Profile.`}
            </p>

            <div className="mt-5">
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${progress >= 80 ? "bg-emerald-500" : "bg-brand-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-ink-500 tabular-nums">
                <span>0</span>
                <span>{goalUnit === "REVENUE" ? fmtINR(Number(progressTarget) / 2) : fmtNum(Number(progressTarget) / 2)}</span>
                <span>{goalUnit === "REVENUE" ? fmtINR(Number(progressTarget)) : fmtNum(Number(progressTarget))}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Revenue" value={fmtINR(wonRevenue)} tone="brand" />
            <Kpi label="Spend" value={fmtINR(totalSpend)} hint={`${budgetUtil.toFixed(0)}% of 6-mo`} />
            <Kpi label="CAC" value={fmtINR(cac)} tone={cac > 0 && cac < 1000 ? "success" : "neutral"} hint="blended" />
            <Kpi
              label="Forecast"
              value={monthsToGoal !== null ? `${monthsToGoal.toFixed(1)}mo` : "—"}
              hint={monthsToGoal !== null ? `at ${monthlyRunRate}/mo` : "need more data"}
            />
          </div>
        </div>
      </Card>

      {/* Funnel — full impressions → revenue chain with drop-off flags */}
      <SectionHeader
        title="Acquisition funnel"
        description="Impressions → visitors → leads → qualified → customers → revenue. The leakiest stage is flagged."
        actions={
          <Link href={`/app/analytics/funnel?clientId=${client.id}`}>
            <Button variant="outline" size="sm">Open funnel analytics</Button>
          </Link>
        }
      />
      <Card padding="lg" className="mb-8">
        <FunnelChart stages={funnelSnapshot.funnel} currency fmtValue={(n) => fmtINR(n)} />
        {funnelSnapshot.worstStage && funnelSnapshot.worstStage.severity > 0 && (
          <div className="mt-4 pt-4 border-t border-ink-100 flex items-start gap-3">
            <Badge variant={funnelSnapshot.worstStage.severity === 2 ? "danger" : "warning"} dot>
              Leak
            </Badge>
            <div className="text-sm text-ink-700">
              <strong>{funnelSnapshot.worstStage.label}</strong> is the leakiest stage — only{" "}
              <strong>{(funnelSnapshot.worstStage.conversionRate! * 100).toFixed(2)}%</strong> of the previous stage reaches it.
              {funnelSnapshot.worstStage.dropOff !== null && funnelSnapshot.worstStage.dropOff > 0 && (
                <> Dropped <strong>{fmtNum(funnelSnapshot.worstStage.dropOff)}</strong> units.</>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Top channels + current issue */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Channel leaderboard</h3>
              <p className="text-xs text-ink-500 mt-0.5">Sorted by value-adjusted CPL — lowest is best.</p>
            </div>
            <Link href={`/app/clients/${client.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">All campaigns →</Link>
          </div>
          {leaderboard.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-500">
              No campaign data yet. The Strategy Agent will spin up campaigns automatically once you give it a goal.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Campaign</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Leads</th>
                  <th className="px-5 py-2.5 text-right">Qualified %</th>
                  <th className="px-5 py-2.5 text-right">CAC</th>
                  <th className="px-5 py-2.5 text-right">Eff. CPL</th>
                  <th className="px-5 py-2.5 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 8).map((c) => (
                  <tr key={c.campaignId} className="border-t border-ink-100 hover:bg-ink-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/app/campaigns/${c.campaignId}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                        {c.name}
                      </Link>
                      <div className="text-xs text-ink-500 mt-0.5">{c.platform}</div>
                    </td>
                    <td className="px-5 py-3"><Badge variant={c.status === "ACTIVE" ? "success" : c.status === "PAUSED" ? "warning" : "neutral"} dot>{c.status}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(c.leads)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={c.qualifiedRate >= 0.2 ? "text-emerald-700 font-medium" : c.qualifiedRate >= 0.1 ? "text-ink-900" : "text-rose-700"}>
                        {fmtPct(c.qualifiedRate * 100, 1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtINR(c.cac)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      <span className={c.effectiveCpl < 1000 ? "text-emerald-700" : c.effectiveCpl < 5000 ? "text-ink-900" : "text-rose-700"}>
                        {fmtINR(c.effectiveCpl)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={c.roas >= 2 ? "text-emerald-700 font-medium" : c.roas >= 1 ? "text-ink-900" : c.revenue > 0 ? "text-rose-700" : "text-ink-400"}>
                        {c.revenue > 0 ? `${c.roas.toFixed(2)}×` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card padding="lg">
          <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">Highlights</div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 mb-4">Top channel & creative</h3>

          {topChannel ? (
            <div className="rounded-lg border border-ink-200/70 bg-ink-50/40 p-3 mb-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mb-1">Top channel (value-adj.)</div>
              <Link href={`/app/campaigns/${topChannel.campaignId}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                {topChannel.name}
              </Link>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-ink-500">Leads</div>
                  <div className="font-medium tabular-nums">{fmtNum(topChannel.leads)}</div>
                </div>
                <div>
                  <div className="text-ink-500">Eff. CPL</div>
                  <div className="font-medium tabular-nums text-emerald-700">{fmtINR(topChannel.effectiveCpl)}</div>
                </div>
                <div>
                  <div className="text-ink-500">ROAS</div>
                  <div className="font-medium tabular-nums">{topChannel.roas.toFixed(2)}×</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-500 mb-3">No channels have generated leads yet.</div>
          )}

          {topCreative ? (
            <div className="rounded-lg border border-ink-200/70 bg-ink-50/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mb-1">Top creative (by leads)</div>
              <Link href={`/app/creatives/${topCreative.id}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                {topCreative.name}
              </Link>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-ink-500">Leads</div>
                  <div className="font-medium tabular-nums">{fmtNum(topCreative.leads)}</div>
                </div>
                <div>
                  <div className="text-ink-500">CTR</div>
                  <div className="font-medium tabular-nums">{fmtPct(topCreative.ctr, 2)}</div>
                </div>
                <div>
                  <div className="text-ink-500">Conv.</div>
                  <div className="font-medium tabular-nums">{fmtNum(topCreative.conversions)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-500">No creatives have generated leads yet.</div>
          )}
        </Card>
      </div>

      {/* Current issue + recommended action */}
      <SectionHeader title="Diagnosis & next moves" description="Adziga is watching for underperformance and proposes the next action." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {worstChannel && worstChannel.campaignId !== topChannel?.campaignId ? (
          <Card padding="lg" className="border-amber-200/70 bg-amber-50/30">
            <div className="flex items-start gap-3">
              <Badge variant="warning" dot>Issue</Badge>
              <div className="flex-1">
                <div className="text-sm font-medium text-ink-900">
                  {worstChannel.name} qualified-lead cost is {fmtINR(worstChannel.effectiveCpl)} per qualified lead.
                </div>
                <div className="text-xs text-ink-600 mt-2 leading-relaxed">
                  Only <strong>{fmtPct(worstChannel.qualifiedRate * 100, 1)}</strong> of leads from this campaign become qualified. With{" "}
                  {fmtNum(worstChannel.leads)} leads and {fmtNum(worstChannel.customers)} customers so far, the campaign is producing
                  expensive leads without proportional revenue.
                </div>
                <div className="mt-3 pt-3 border-t border-amber-200/60">
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Recommended action</div>
                  <div className="text-sm text-ink-700 leading-relaxed">
                    Open a new creative brief with stricter audience targeting, or reallocate 30% of the budget to{" "}
                    {topChannel ? (
                      <Link href={`/app/campaigns/${topChannel.campaignId}`} className="text-brand-600 hover:underline font-medium">{topChannel.name}</Link>
                    ) : "your top channel"}.
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link href={`/app/studio/briefs/new?clientId=${client.id}&campaignId=${worstChannel.campaignId}`}>
                      <Button variant="outline" size="sm">Open a brief</Button>
                    </Link>
                    <Link href="/app/admin/approvals">
                      <Button variant="ghost" size="sm">Queue budget reallocation</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="lg">
            <div className="flex items-start gap-3">
              <Badge variant="success" dot>On track</Badge>
              <div>
                <div className="text-sm font-medium text-ink-900">All channels performing within target.</div>
                <div className="text-xs text-ink-600 mt-2 leading-relaxed">
                  No underperformers flagged. Keep feeding the system — attribution rollups will start showing
                  lead-to-customer patterns after {Math.max(0, 5 - clientCustomers.length)} more conversions.
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card padding="lg">
          <div className="flex items-start gap-3">
            <Badge variant="brand" dot>Next priority</Badge>
            <div className="flex-1">
              <div className="text-sm font-medium text-ink-900 mb-2">
                {qualifiedLeads > 0 && wonCustomers === 0
                  ? "Convert qualified leads to customers"
                  : monthlyRunRate < (goalValue / 6) / 30
                  ? "Increase monthly acquisition run-rate"
                  : "Maintain acquisition velocity"}
              </div>
              <div className="text-xs text-ink-600 leading-relaxed">
                {qualifiedLeads > 0 && wonCustomers === 0
                  ? `You have ${fmtNum(qualifiedLeads)} qualified leads with no customers yet. Schedule consultations, send proposals, and let Adziga track the conversion.`
                  : monthlyRunRate < 5
                  ? `Recent run-rate is ${monthlyRunRate}/month. To hit the goal in 6 months you need ~${Math.ceil(goalValue / 6)}/month. Either scale budgets or open new channels.`
                  : `Acquisition run-rate is healthy at ${monthlyRunRate}/month. Focus on incremental wins: creative refresh, audience expansion, and re-engagement of warm leads.`}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link href={`/app/ai?clientId=${client.id}`}>
                  <Button size="sm">Discuss with Strategy Agent</Button>
                </Link>
                <Link href={`/app/leads?clientId=${client.id}&status=QUALIFIED`}>
                  <Button variant="outline" size="sm">See qualified leads</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <SectionHeader title="Recent activity" description="Latest approved changes, conversions, and decisions." />
      <Card padding="none">
        <RecentActivity orgId={session.orgId} clientId={client.id} />
      </Card>
    </div>
  );
}

function FunnelStage_REMOVED() {
  // Legacy component removed — FunnelChart is used instead.
}

async function RecentActivity({ orgId, clientId }: { orgId: string; clientId: string }) {
  const [recentCustomers, recentLeads, recentApprovals] = await Promise.all([
    prisma.customer.findMany({
      where: { orgId, clientId },
      orderBy: { acquiredAt: "desc" },
      take: 5,
      include: { acquiredCampaign: { select: { name: true } } }
    }),
    prisma.lead.findMany({
      where: { orgId, clientId, status: "WON" },
      orderBy: { convertedAt: "desc" },
      take: 5
    }),
    prisma.approval.findMany({
      where: { orgId, status: { in: ["applied", "rejected"] } },
      orderBy: { decidedAt: "desc" },
      take: 5
    })
  ]);

  const items = [
    ...recentCustomers.map((c) => ({
      type: "customer" as const,
      when: c.acquiredAt,
      text: `New customer acquired via ${c.acquiredCampaign?.name ?? "organic"} — ${fmtINR(c.revenue)}`
    })),
    ...recentLeads
      .filter((l) => !recentCustomers.find((c) => c.leadId === l.id))
      .map((l) => ({
        type: "lead" as const,
        when: l.convertedAt ?? l.createdAt,
        text: `Lead "${l.name ?? l.email ?? l.id.slice(0, 6)}" marked WON — ${fmtINR(l.revenue)}`
      })),
    ...recentApprovals
      .filter((a) => a.entityType === "Client" || a.entityType === "Campaign")
      .map((a) => ({
        type: "approval" as const,
        when: a.decidedAt ?? a.requestedAt,
        text: `Approval ${a.status} — ${a.title}`
      }))
  ]
    .filter((it) => it.when !== null)
    .sort((a, b) => new Date(b.when!).getTime() - new Date(a.when!).getTime())
    .slice(0, 10);

  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-ink-500">
        No recent activity yet. Activity will appear here as leads convert and approvals are decided.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100">
      {items.map((it, i) => (
        <li key={i} className="px-5 py-3 flex items-center gap-3">
          <Badge variant={it.type === "customer" ? "success" : it.type === "approval" ? "brand" : "neutral"} dot>
            {it.type}
          </Badge>
          <div className="text-sm text-ink-700 flex-1">{it.text}</div>
          <span className="text-xs text-ink-400 shrink-0">{it.when ? fmtRelative(it.when) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
