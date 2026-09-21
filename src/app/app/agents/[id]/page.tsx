// /app/agents/[id] — single-agent chat (creates a thread on first message)

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { AgentChat } from "./_chat";
import { PageHeader } from "../../_components/page-header";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await prisma.agent.findFirst({
    where: { id: params.id, orgId: session.orgId }
  });
  if (!agent) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-500">Agent not found.</p>
      </div>
    );
  }

  const recentThreads = await prisma.agentThread.findMany({
    where: { orgId: session.orgId, agentId: agent.id },
    orderBy: { lastMessageAt: "desc" },
    take: 10
  });

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title={agent.name}
        subtitle={agent.description ?? "AI worker"}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <AgentChat agent={agent} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Permissions</h2>
          <div className="card-v0 p-4 mb-4 text-xs">
            <div className="font-semibold text-ink-900 mb-2">What this agent can do</div>
            <div className="space-y-1 text-ink-700">
              {agent.permissions
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <code className="text-[11px] bg-ink-100 px-1.5 py-0.5 rounded">{p}</code>
                  </div>
                ))}
              {!agent.permissions && <span className="text-ink-400">No permissions</span>}
            </div>
            <div className="mt-3 pt-3 border-t border-ink-100 text-ink-500">
              Trigger: <span className="text-ink-900">{agent.trigger}</span>
              {agent.cronExpr && ` · ${agent.cronExpr}`}
            </div>
          </div>

          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Recent threads</h2>
          <div className="card-v0 divide-y divide-ink-100">
            {recentThreads.length === 0 ? (
              <div className="p-4 text-center text-ink-500 text-xs">No conversations yet.</div>
            ) : (
              recentThreads.map((t) => (
                <a
                  key={t.id}
                  href={`/app/agents/threads/${t.id}`}
                  className="block px-4 py-2.5 hover:bg-ink-50 transition-colors text-xs first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="font-medium text-ink-900 truncate">{t.title}</div>
                  <div className="text-ink-400 text-[11px] mt-0.5">{fmtDateTime(t.lastMessageAt)}</div>
                </a>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
