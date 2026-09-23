// Adziga — /app/admin/agents
// Sprint 15a — agent observability dashboard. Shows recent runs, tool
// usage frequency, token totals, and per-agent rollup.

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtNum, fmtRelative, fmtDateTime } from "@/lib/format";
import Link from "next/link";
import { AgentCostAlertService } from "@/server/services/agent-cost";
import { CostLimitsEditor } from "./cost-limits-editor";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [1, 7, 30, 90] as const;

export default async function AgentsObservabilityPage({
  searchParams
}: {
  searchParams: { days?: string; agentId?: string };
}) {
  const sessionInfo = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const agentFilter = searchParams.agentId;

  // Sprint 18c — load any stored cost alerts to surface at top of page.
  const costAlerts = await AgentCostAlertService.getStoredAlerts(sessionInfo.orgId);

  const [
    runs,
    perAgent,
    perTool,
    totals,
    agents
  ] = await Promise.all([
    prisma.agentRun.findMany({
      where: {
        startedAt: { gte: since },
        ...(agentFilter ? { agentId: agentFilter } : {})
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { agent: { select: { name: true, role: true } } }
    }),
    prisma.$queryRaw<Array<{ agentId: string; name: string; role: string; n: bigint; toolCalls: bigint; tokens: bigint }>>`
      SELECT a.id AS "agentId", a.name, a.role,
             COUNT(r.id)::bigint AS n,
             COALESCE(SUM(r."toolCallCount"), 0)::bigint AS "toolCalls",
             COALESCE(SUM(COALESCE(r."tokensIn", 0) + COALESCE(r."tokensOut", 0)), 0)::bigint AS tokens
      FROM "Agent" a
      LEFT JOIN "AgentRun" r ON r."agentId" = a.id AND r."startedAt" >= ${since}
      GROUP BY a.id, a.name, a.role
      ORDER BY n DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ type: string; n: bigint }>>`
      SELECT type, COUNT(*)::bigint AS n
      FROM "AgentAction"
      WHERE "startedAt" >= ${since} ${agentFilter ? Prisma.sql`AND "agentId" = ${agentFilter}` : Prisma.empty}
      GROUP BY type
      ORDER BY n DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ n: bigint; toolCalls: bigint; tokens: bigint }>>`
      SELECT COUNT(*)::bigint AS n,
             COALESCE(SUM("toolCallCount"), 0)::bigint AS "toolCalls",
             COALESCE(SUM(COALESCE("tokensIn", 0) + COALESCE("tokensOut", 0)), 0)::bigint AS tokens
      FROM "AgentRun"
      WHERE "startedAt" >= ${since} ${agentFilter ? Prisma.sql`AND "agentId" = ${agentFilter}` : Prisma.empty}
    `,
    prisma.agent.findMany({
      orderBy: [{ enabled: "desc" }, { name: "asc" }]
    })
  ]);

  const totalsRow = totals[0] ?? { n: 0n, toolCalls: 0n, tokens: 0n };
  // Rough cost estimate: 60% input / 40% output, model average ~₹0.50 per 1K blended tokens.
  const costEstimate = Number(totalsRow.tokens) * 0.0005;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent observability"
        subtitle="Run history, tool usage, and token totals across every agent in this org. Helps answer 'what is the AI doing?' and 'what's it costing?'"
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Agents" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-1">Window:</span>
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`?days=${d}${agentFilter ? `&agentId=${agentFilter}` : ""}`}
                className={`px-2 py-1 rounded ${d === days ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      {/* Agent filter */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Agent:</span>
        <Link
          href={`?days=${days}`}
          className={`px-3 py-1 rounded ${!agentFilter ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
        >
          All
        </Link>
        {agents.map((a) => (
          <Link
            key={a.id}
            href={`?days=${days}&agentId=${a.id}`}
            className={`px-3 py-1 rounded ${agentFilter === a.id ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
          >
            {a.name} <span className="text-[10px] opacity-60">({a.role})</span>
          </Link>
        ))}
      </div>

      {/* Sprint 18c — cost alerts banner */}
      {costAlerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {costAlerts.map((a) => {
            const isCritical = a.severity === "critical";
            return (
              <div
                key={a.id}
                className={`rounded-lg ring-1 p-3 ${
                  isCritical ? "bg-rose-50 ring-rose-200" : "bg-amber-50 ring-amber-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] uppercase tracking-wide font-semibold ${isCritical ? "text-rose-700" : "text-amber-700"}`}>
                      {a.severity} · agent_cost
                    </div>
                    <p className="text-sm text-ink-900 mt-1">{a.message}</p>
                    <p className="text-[10px] text-ink-500 mt-1 font-mono">
                      Raised {fmtRelative(new Date(a.raisedAt))} · threshold ₹{a.threshold.toFixed(0)} · observed ₹{a.observed.toFixed(0)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <a
                      href="/app/admin/agents"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Tune policy →
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Runs" value={fmtNum(Number(totalsRow.n))} hint={`last ${days} days`} />
        <Kpi label="Tool calls" value={fmtNum(Number(totalsRow.toolCalls))} hint="across all agents" />
        <Kpi label="Tokens" value={fmtNum(Number(totalsRow.tokens))} hint="input + output" />
        <Kpi label="Est. cost" value={`₹${costEstimate.toFixed(2)}`} hint="₹0.50/1K tokens (blended estimate)" />
      </div>

      {/* Per-agent rollup */}
      <SectionHeader title="Per-agent" description="Last 7 days of activity, sorted by run count" />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Tool calls</th>
                <th className="text-right">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {perAgent.map((a) => (
                <tr key={a.agentId} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 text-xs"><Badge variant="neutral">{a.role}</Badge></td>
                  <td className="px-4 py-2 text-right font-mono">{Number(a.n)}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(a.toolCalls)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtNum(Number(a.tokens))}</td>
                </tr>
              ))}
              {perAgent.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-ink-500 py-6">No agent runs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sprint 18c — Cost limits editor */}
      <SectionHeader
        title="LLM cost limits"
        description="Daily / weekly thresholds that raise a banner on this page when crossed. Defaults: ₹200/day, ₹1000/week."
      />
      <Card padding="lg">
        <CostLimitsEditor
          initial={{
            dailyLimit: Math.round(costEstimate * 10),
            weeklyLimit: Math.round(costEstimate * 30),
            enabled: true
          }}
        />
      </Card>

      {/* Tool usage */}
      {perTool.length > 0 && (
        <>
          <SectionHeader title="Top tools" description="Most-invoked actions across the window" />
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="text-left px-4 py-2">Tool</th>
                    <th className="text-right">Invocations</th>
                  </tr>
                </thead>
                <tbody>
                  {perTool.map((t) => (
                    <tr key={t.type} className="border-b border-ink-100">
                      <td className="px-4 py-2 font-mono text-xs">{t.type}</td>
                      <td className="px-4 py-2 text-right font-mono">{Number(t.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Recent runs */}
      <SectionHeader title="Recent runs" description={`${runs.length} most recent`} />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-left px-4 py-2">Trigger</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right">Tools</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-ink-100">
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    <div>{fmtRelative(r.startedAt)}</div>
                    <div className="text-ink-500 font-mono">{fmtDateTime(r.startedAt).slice(11, 19)}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="font-medium">{r.agent?.name ?? "—"}</div>
                    <div className="text-ink-500">{r.agent?.role ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Badge variant="neutral">{r.trigger}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{r.toolCallCount}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {fmtNum((r.tokensIn ?? 0) + (r.tokensOut ?? 0))}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{r.durationMs ?? 0}ms</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-ink-500 py-6">
                    No agent runs in this window. Try a chat with the Strategy Agent to generate activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function statusVariant(s: string): "neutral" | "brand" | "success" | "warning" | "accent" {
  if (s === "completed") return "success";
  if (s === "failed") return "warning";
  if (s === "running") return "brand";
  return "neutral";
}

