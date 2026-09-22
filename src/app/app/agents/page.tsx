// Adziga — Agent Inbox at /app/agents
// List of AI agents + their threads. Editorial layout with status pills,
// last-run metadata, and a clean threads panel.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, EmptyState, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await requireSession();

  const [agents, threads, recentActions] = await Promise.all([
    prisma.agent.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "asc" } }),
    prisma.agentThread.findMany({
      where: { orgId: session.orgId },
      orderBy: { lastMessageAt: "desc" },
      take: 12,
      include: {
        agent: { select: { id: true, name: true, role: true } },
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } }
      }
    }),
    prisma.agentAction.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { agent: { select: { name: true } } }
    })
  ]);

  const enabledCount = agents.filter((a) => a.enabled).length;
  const totalRuns = agents.reduce((s, a) => s + a.totalRuns, 0);
  const erroredAgents = agents.filter((a) => a.lastError).length;

  return (
    <div>
      <PageHeader
        eyebrow="AI Workforce"
        title="Agents"
        subtitle="AI workers that plan, execute, and report for your clients. Each agent has a role, permissions, and a memory of past conversations."
        breadcrumbs={[{ label: "Agents" }]}
        right={
          <Link href="/app/ai">
            <Button variant="outline">Open AI workspace</Button>
          </Link>
        }
      />

      {session.isImpersonating && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-3 text-sm text-amber-900">
            <Badge variant="warning" dot>Impersonating</Badge>
            <span>You're acting as this client org. All actions are logged.</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Agents" value={agents.length.toString()} hint={`${enabledCount} enabled`} />
        <Kpi label="Total runs" value={totalRuns.toLocaleString("en-IN")} tone="brand" />
        <Kpi label="Threads" value={threads.length.toString()} hint="recent" tone="accent" />
        <Kpi
          label="Health"
          value={erroredAgents === 0 ? "OK" : `${erroredAgents} errored`}
          tone={erroredAgents === 0 ? "success" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-8">
        {/* Agent roster */}
        <div>
          <SectionHeader title="Your agents" description="Click an agent to open its threads or start a new conversation." />
          {agents.length === 0 ? (
            <Card>
              <EmptyState
                title="No agents yet"
                description="Agents are auto-provisioned on org creation. Run scripts/reprovision-agents.mjs to seed the 8 default agents."
              />
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {agents.map((a) => (
                <Link
                  key={a.id}
                  href={`/app/agents/${a.id}`}
                  className="group block rounded-xl border border-ink-200/70 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-brand-soft focus-ring"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                      {a.role.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-900 truncate">{a.name}</h3>
                        {!a.enabled && <Badge variant="neutral">Off</Badge>}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-brand-600 font-semibold mb-1">{a.role}</div>
                      <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed">{a.description}</p>
                      <div className="text-[11px] text-ink-400 mt-2 flex items-center gap-2">
                        <span className="tabular-nums">{a.totalRuns.toLocaleString("en-IN")} runs</span>
                        {a.lastRunAt && <><span aria-hidden>·</span><span>last {fmtRelative(a.lastRunAt)}</span></>}
                        {a.lastError && <Badge variant="danger">errored</Badge>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <SectionHeader
            title="Recent threads"
            description="Latest conversations across all agents."
            actions={<Link href="/app/agents/threads" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all →</Link>}
          />
          <Card padding="none">
            {threads.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState title="No conversations yet" description="Pick an agent on the left to start one." />
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {threads.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/agents/threads/${t.id}`} className="block px-4 py-3 hover:bg-ink-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium text-ink-900 truncate flex-1">{t.title}</div>
                        <span className="text-[11px] text-ink-400 tabular-nums whitespace-nowrap shrink-0">{fmtRelative(t.lastMessageAt)}</span>
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5 truncate">
                        <span className="font-medium text-brand-600">{t.agent.name}</span>
                        {t.user && <> · {t.user.name ?? t.user.email}</>}
                        <span className="text-ink-400"> · {t._count.messages} msg</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Recent agent activity */}
      <SectionHeader title="Recent agent activity" description="Tool calls and decisions across the team." />
      <Card padding="none">
        {recentActions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-500">No agent activity recorded yet.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {recentActions.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900 truncate">{a.summary}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    <span className="font-medium text-brand-600">{a.agent.name}</span> · <code className="text-[11px]">{a.type}</code>
                  </div>
                </div>
                <span className="text-xs text-ink-400 shrink-0">{fmtRelative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
