// Adziga — Agent Inbox at /app/agents
// List of agents + their threads. Click an agent to start a thread or open existing threads.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { fmtDateTime, relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await requireSession();

  const agents = await prisma.agent.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "asc" }
  });

  const threads = await prisma.agentThread.findMany({
    where: { orgId: session.orgId },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    include: {
      agent: { select: { name: true, role: true } },
      user: { select: { name: true, email: true } }
    }
  });

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Agents"
        subtitle="AI workers that run Adziga for you. Strategy, ad ops, content, WhatsApp, reporting."
      />

      {session.isImpersonating && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg px-4 py-2.5">
          ⚠️ You're acting as this client org. All actions are logged.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Your agents</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/app/agents/${a.id}`}
                className="card-v0 p-4 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {a.role.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-900 truncate">{a.name}</h3>
                      {!a.enabled && (
                        <span className="text-[10px] uppercase tracking-wide bg-ink-100 text-ink-500 px-1.5 py-0.5 rounded">off</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 line-clamp-2 mt-0.5">{a.description}</p>
                    <div className="text-[11px] text-ink-400 mt-2">
                      {a.totalRuns} run{a.totalRuns === 1 ? "" : "s"}
                      {a.lastRunAt && ` · last ${relTime(a.lastRunAt)}`}
                      {a.lastError && <span className="text-red-600"> · error</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {agents.length === 0 && (
              <div className="col-span-2 card-v0 p-6 text-center text-ink-500 text-sm">
                No agents yet. They will be provisioned on next signup.
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Recent threads</h2>
          <div className="card-v0 divide-y divide-ink-100">
            {threads.length === 0 ? (
              <div className="p-6 text-center text-ink-500 text-sm">
                No conversations yet. Pick an agent to start.
              </div>
            ) : (
              threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/agents/threads/${t.id}`}
                  className="block px-4 py-3 hover:bg-ink-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-ink-900 truncate flex-1">{t.title}</div>
                    <span className="text-[11px] text-ink-400 tabular-nums whitespace-nowrap">
                      {relTime(t.lastMessageAt)}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">
                    with {t.agent.name}
                    {t.user && ` · ${t.user.name ?? t.user.email}`}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
