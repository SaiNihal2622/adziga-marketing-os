import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { AskAssistant } from "./ask-form";
import { fmtINR, fmtNum, fmtPct, cpl, roas } from "@/lib/format";

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

  const kpis = {
    cpl: cpl(recentCampaigns.reduce((s, c) => s + c.spent, 0), recentCampaigns.reduce((s, c) => s + Number(c.leads), 0)),
    cac: recentCampaigns.length ? recentCampaigns.reduce((s, c) => s + c.spent, 0) / Math.max(1, recentCampaigns.reduce((s, c) => s + Number(c.customers), 0)) : 0,
    roas: roas(recentCampaigns.reduce((s, c) => s + c.revenue, 0), recentCampaigns.reduce((s, c) => s + c.spent, 0)),
    conversion: (recentCampaigns.reduce((s, c) => s + Number(c.customers), 0) / Math.max(1, recentCampaigns.reduce((s, c) => s + Number(c.leads), 0))) * 100
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="Controlled AI help. Explains KPIs, summarizes reports, answers campaign questions. Does NOT autonomously execute changes. All interactions are auditable."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Ask the assistant</h3>
          <AskAssistant
            clients={clients.map((c) => ({ id: c.id, name: c.businessName }))}
            defaultClientId={searchParams.clientId}
          />

          <div className="mt-6 pt-6 border-t border-ink-100">
            <h3 className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-2">Try asking</h3>
            <div className="flex flex-wrap gap-2">
              {[
                "Why did CPL increase last week?",
                "Summarize September performance",
                "What's our current ROAS?",
                "Status of active campaigns"
              ].map((q) => (
                <a key={q} href={`/app/ai?q=${encodeURIComponent(q)}`} className="badge badge-neutral">{q}</a>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-ink-100">
            <h3 className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-2">Governance</h3>
            <ul className="text-xs text-ink-600 space-y-1.5">
              <li>• Assistant never executes changes — only explains data and submits requests.</li>
              <li>• Every prompt + response is logged in AIInteraction (audit trail).</li>
              <li>• Future RECOMMEND / AUTOMATE modes will require approval workflows.</li>
              <li>• AI does NOT have unrestricted database access — only the controlled context shown to it.</li>
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Current context (read-only)</h3>
          <div className="space-y-2 text-sm">
            <KpiLine label="Spend" value={fmtINR(recentCampaigns.reduce((s, c) => s + c.spent, 0))} />
            <KpiLine label="Leads" value={fmtNum(recentCampaigns.reduce((s, c) => s + Number(c.leads), 0))} />
            <KpiLine label="CPL" value={fmtINR(kpis.cpl)} />
            <KpiLine label="CAC" value={fmtINR(kpis.cac)} />
            <KpiLine label="ROAS" value={`${kpis.roas.toFixed(2)}x`} />
            <KpiLine label="Conv." value={fmtPct(kpis.conversion)} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">Conversation history (last 20)</h3>
        <table className="table">
          <thead><tr><th>When</th><th>Prompt</th><th>Response (truncated)</th><th>Model</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="text-xs text-ink-500 whitespace-nowrap">{new Date(h.createdAt).toLocaleString("en-IN")}</td>
                <td className="text-sm">{h.prompt}</td>
                <td className="text-xs text-ink-600 max-w-md truncate">{h.response}</td>
                <td className="text-xs font-mono">{h.model}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-ink-500">{label}</div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}