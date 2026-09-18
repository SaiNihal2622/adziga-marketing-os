import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtDate, fmtDateTime } from "@/lib/format";
import { PlanControls } from "./controls";

export const dynamic = "force-dynamic";

export default async function PlanDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const plan = await prisma.orchestrationPlan.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { campaigns: { orderBy: { order: "asc" } } }
  });
  if (!plan) notFound();

  const strategy = plan.strategy ? JSON.parse(plan.strategy) : null;
  const reasoning = plan.reasoning ? JSON.parse(plan.reasoning) : null;

  const nextActions: Array<{ label: string; action: string; variant: "primary" | "secondary" | "danger" }> = [];
  if (plan.status === "DRAFT") {
    nextActions.push({ label: "Submit for internal review", action: "submit_internal_review", variant: "primary" });
  }
  if (plan.status === "INTERNAL_REVIEW") {
    nextActions.push({ label: "Submit for client approval", action: "submit_client_approval", variant: "primary" });
    nextActions.push({ label: "Cancel", action: "cancel", variant: "danger" });
  }
  if (plan.status === "CLIENT_APPROVAL") {
    nextActions.push({ label: "Approve & Deploy", action: "approve", variant: "primary" });
    nextActions.push({ label: "Reject", action: "cancel", variant: "danger" });
  }
  if (plan.status === "APPROVED") {
    nextActions.push({ label: "Execute (create campaigns)", action: "deploy", variant: "primary" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${plan.goalType}: ${plan.goalQuantity.toLocaleString("en-IN")} ${plan.goalMetric}`}
        subtitle={`By ${fmtDate(plan.goalDeadline)} - Created ${fmtDateTime(plan.createdAt)}`}
        breadcrumbs={[{ label: "Orchestrate", href: "/app/orchestrate" }, { label: `Plan ${plan.id.slice(0, 8)}` }]}
        right={
          <>
            <span className={`badge ${plan.confidence > 0.7 ? "badge-success" : plan.confidence > 0.5 ? "badge-warning" : "badge-neutral"}`}>
              {(plan.confidence * 100).toFixed(0)}% conf
            </span>
            <StatusPill status={plan.status} />
          </>
        }
      />

      <PlanControls planId={plan.id} actions={nextActions} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-ink-700">Budget allocation</h3>
          {strategy && (
            <div>
              <div className="text-3xl font-bold">INR {strategy.budget.totalMonthly.toLocaleString("en-IN")}<span className="text-base font-normal text-ink-500">/month</span></div>
              <div className="mt-3 space-y-2">
                {strategy.budget.split.map((s: any) => (
                  <div key={s.channel}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div>{s.channel}</div>
                      <div className="font-mono">INR {s.amount.toLocaleString("en-IN")} ({s.pct}%)</div>
                    </div>
                    <div className="h-2 bg-ink-100 rounded">
                      <div className="h-2 rounded bg-brand-500" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-ink-700">Estimated outcomes</h3>
          <div className="flex justify-between text-sm">
            <div className="text-ink-500">Expected CPL</div>
            <div className="font-mono">INR {plan.estimatedCpl}</div>
          </div>
          <div className="flex justify-between text-sm">
            <div className="text-ink-500">Expected CAC</div>
            <div className="font-mono">INR {plan.estimatedCac}</div>
          </div>
          <div className="flex justify-between text-sm">
            <div className="text-ink-500">Expected ROAS</div>
            <div className="font-mono">{plan.expectedRoas.toFixed(2)}x</div>
          </div>
          <div className="flex justify-between text-sm">
            <div className="text-ink-500">Timeline</div>
            <div className="font-mono">{strategy?.timeline?.durationDays ?? "-"} days</div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">Campaigns ({plan.campaigns.length})</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Objective</th>
              <th className="text-right">Budget</th>
              <th className="text-right">Days</th>
              <th className="text-right">Expected CPL</th>
              <th className="text-right">Expected Leads</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.campaignId ? <Link href={`/app/campaigns/${c.campaignId}`} className="text-brand-600 hover:underline">{c.name}</Link> : c.name}
                  <div className="text-xs text-ink-500 mt-0.5">{JSON.parse(c.creativeBrief).format} - {JSON.parse(c.creativeBrief).hookPattern?.slice(0, 40)}...</div>
                </td>
                <td><span className="badge badge-neutral">{c.platform}</span></td>
                <td>{c.objective}</td>
                <td className="text-right font-mono text-xs">{fmtINR(c.budget)}</td>
                <td className="text-right text-xs">{c.durationDays}</td>
                <td className="text-right font-mono text-xs">INR {c.expectedCpl}</td>
                <td className="text-right font-mono text-xs">{c.expectedLeads}</td>
                <td>
                  {c.status === "DEPLOYED" && c.campaignId ? (
                    <Link href={`/app/campaigns/${c.campaignId}`} className="badge badge-success">Deployed </Link>
                  ) : (
                    <span className="badge badge-neutral">{c.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reasoning && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Why this plan?</h3>
          <div className="text-sm space-y-2">
            <div>Based on <strong>{reasoning.basedOnSample}</strong> similar campaigns from your history.</div>
            {reasoning.benchmarksUsed?.length > 0 && (
              <div>
                Used {reasoning.benchmarksUsed.length} industry benchmarks.
              </div>
            )}
            {reasoning.notes?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
                <strong>Notes:</strong> {reasoning.notes.join(" - ")}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-4 bg-ink-50 border-ink-200 text-xs text-ink-600">
        <strong>Governance:</strong> Per spec ??10 + ??29, plans never auto-deploy. Every transition (Internal Review  Client Approval  Approved  Execute) is an explicit human action logged to AuditLog.
      </div>
    </div>
  );
}