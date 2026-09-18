import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate, fmtDateTime } from "@/lib/format";
import { OrchestrateForm } from "./form";

export const dynamic = "force-dynamic";

export default async function OrchestratePage() {
  const session = await requireSession();
  const [plans, clients] = await Promise.all([
    prisma.orchestrationPlan.findMany({
      where: { orgId: session.orgId },
      include: { campaigns: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Orchestration"
        subtitle="Phase 4. Describe the business outcome. Adziga assembles a plan: channels, budget, campaigns, creatives. You approve. It deploys."
        right={<span className="badge badge-accent">Phase 4</span>}
      />

      <div className="card p-6 bg-gradient-to-r from-brand-50 to-accent-50 border-brand-200">
        <div className="flex items-start gap-3">
          <div className="text-2xl">[Goal]</div>
          <div>
            <h3 className="font-semibold text-ink-900">How orchestration works</h3>
            <p className="text-sm text-ink-700 mt-1">
              "Generate 500 qualified leads for my business." Adziga uses Strategy Intelligence + Content Intelligence
              to propose a complete plan with channels, budget, campaigns, and creative briefs.
              Nothing deploys without your approval.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Describe your goal</h3>
        <OrchestrateForm clients={clients.map((c) => ({ id: c.id, name: c.businessName }))} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-700">Existing plans ({plans.length})</h3>
        {plans.length === 0 && <p className="card p-6 text-center text-ink-500">No plans yet. Generate one above.</p>}
        {plans.map((p) => {
          const strategy = p.strategy ? JSON.parse(p.strategy) : null;
          return (
            <Link key={p.id} href={`/app/orchestrate/${p.id}`} className="card p-5 hover:shadow-md block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-ink-500">
                    {p.clientId ? clients.find((c) => c.id === p.clientId)?.businessName ?? "Internal" : "Internal"} -
                    {" "}{fmtDateTime(p.createdAt)}
                  </div>
                  <div className="font-semibold mt-1">
                    {p.goalType}: {p.goalQuantity.toLocaleString("en-IN")} {p.goalMetric} by {fmtDate(p.goalDeadline)}
                  </div>
                  <div className="text-sm text-ink-600 mt-1">
                    Budget: INR {p.estimatedCost.toLocaleString("en-IN")}/mo - {p.campaigns.length} campaigns -
                    Expected CPL INR {p.estimatedCpl}, ROAS {p.expectedRoas.toFixed(2)}x
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${p.confidence > 0.7 ? "badge-success" : p.confidence > 0.5 ? "badge-warning" : "badge-neutral"}`}>
                    {(p.confidence * 100).toFixed(0)}% conf
                  </span>
                  <StatusPill status={p.status} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}