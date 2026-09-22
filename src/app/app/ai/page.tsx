// Adziga — /app/ai
// AI Assistant workspace. Read-only context by default; autonomous actions
// route through approval. Editorial layout — chat on the left, KPIs and
// governance on the right, history below.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { AskAssistant } from "./ask-form";
import { Badge, Button, Card, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtPct, fmtRelative, cpl, roas } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AIPage({ searchParams }: { searchParams: { q?: string; clientId?: string } }) {
  const session = await requireSession();

  const [clients, history, recentCampaigns] = await Promise.all([
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } }),
    prisma.aIInteraction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.campaign.findMany({ where: { orgId: session.orgId } })
  ]);

  const totalSpend = recentCampaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = recentCampaigns.reduce((s, c) => s + Number(c.leads), 0);
  const totalCustomers = recentCampaigns.reduce((s, c) => s + Number(c.customers), 0);
  const totalRevenue = recentCampaigns.reduce((s, c) => s + c.revenue, 0);

  const kpis = {
    cpl: cpl(totalSpend, totalLeads),
    cac: totalCustomers > 0 ? totalSpend / totalCustomers : 0,
    roas: roas(totalRevenue, totalSpend),
    conversion: totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : 0
  };

  const suggestedPrompts = [
    "Why did CPL increase last week?",
    "Summarize September performance",
    "What's our current ROAS?",
    "Status of active campaigns",
    "Which client has the best ROAS this month?",
    "Where are we losing money?"
  ];

  return (
    <div>
      <PageHeader
        eyebrow="AI"
        title="AI Assistant"
        subtitle="Read-only by default — explains data and drafts recommendations. Autonomous actions go through the approval queue, so nothing changes without a human in the loop."
        breadcrumbs={[{ label: "AI Assistant" }]}
        right={
          <Link href="/app/agents">
            <Button variant="outline">Agent inbox</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-8">
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Ask the assistant</h3>
              <p className="text-xs text-ink-500 mt-1">Pick a client context, then ask. Responses stream in.</p>
            </div>
            <Badge variant="brand" dot>Read-only</Badge>
          </div>

          <AskAssistant
            clients={clients.map((c) => ({ id: c.id, name: c.businessName }))}
            defaultClientId={searchParams.clientId}
          />

          <div className="mt-6 pt-5 border-t border-ink-100">
            <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">Try asking</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((q) => (
                <Link
                  key={q}
                  href={`/app/ai?q=${encodeURIComponent(q)}`}
                  className="px-2.5 py-1.5 rounded-full text-xs bg-ink-50 text-ink-700 border border-ink-200 hover:bg-ink-100 hover:border-ink-300 transition-colors"
                >
                  {q}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-ink-100">
            <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">Governance</div>
            <ul className="text-xs text-ink-600 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">●</span>
                <span>Read-only by default — explains data and drafts recommendations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">●</span>
                <span>Autonomous actions route through the <Link href="/app/admin/approvals" className="text-brand-600 hover:underline font-medium">approval queue</Link> — Adziga admin sign-off required for critical changes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">●</span>
                <span>Every prompt + response is logged in AIInteraction for the audit trail.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">●</span>
                <span>No unrestricted database access — the assistant only sees the controlled context shown in this view.</span>
              </li>
            </ul>
          </div>
        </Card>

        <div className="space-y-3">
          <SectionHeader title="Live context" description="Read-only snapshot of all campaigns" />
          <Kpi label="Spend" value={fmtINR(totalSpend)} tone="brand" />
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Leads" value={fmtNum(totalLeads)} hint={`${fmtINR(kpis.cpl)} CPL`} />
            <Kpi label="Customers" value={fmtNum(totalCustomers)} hint={`${fmtINR(kpis.cac)} CAC`} />
            <Kpi label="Revenue" value={fmtINR(totalRevenue)} />
            <Kpi label="ROAS" value={`${kpis.roas.toFixed(2)}×`} tone={kpis.roas >= 2 ? "success" : "neutral"} />
          </div>
        </div>
      </div>

      <SectionHeader title="Conversation history" description="The last 20 prompts and responses you've sent." />
      <Card padding="none">
        {history.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No history yet. Ask a question above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Prompt</span>
                  <span className="text-xs text-ink-400 shrink-0">{fmtRelative(h.createdAt)}</span>
                </div>
                <div className="text-sm text-ink-900 mb-3 leading-relaxed">{h.prompt}</div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Response</span>
                  <code className="text-[10.5px] text-ink-400">{h.model}</code>
                </div>
                <div className="text-sm text-ink-700 bg-ink-50/60 rounded-lg p-3 leading-relaxed line-clamp-4">{h.response}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
