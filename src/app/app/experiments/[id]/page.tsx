// Adziga — /app/experiments/[id]
// Sprint 6 — detail page with live Bayesian analysis.
// Server component fetches the experiment + analysis; the action buttons
// (start, complete, cancel) post to /api/experiments/[id] via small client islands.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Badge, Card, Kpi, SectionHeader } from "../../_components/ui";
import { fmtDate, fmtPct, fmtINR, fmtNum } from "@/lib/format";
import { ExperimentService } from "@/server/services/experiment-service";
import type { ExperimentAnalysis, VariantStats } from "@/server/services/experiment-service";

export const dynamic = "force-dynamic";

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const conclusion = String(formData.get("conclusion") ?? "");

  if (action === "complete") {
    await ExperimentService.completeExperiment(prisma, id, conclusion);
  } else if (action === "start") {
    await prisma.experiment.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
  } else if (action === "cancel") {
    await prisma.experiment.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date() } });
  } else if (action === "promote") {
    // Sprint 9c — promote winner config into a StrategyRecommendation.
    await ExperimentService.promoteWinner(prisma, id, { createdById: session.userId });
  } else {
    return;
  }
  await audit(session.orgId, session.userId, `experiment.${action}`, { entityType: "Experiment", entityId: id });
}

export default async function ExperimentDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const e = await prisma.experiment.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, campaign: true, variants: { orderBy: { id: "asc" } } }
  });
  if (!e) notFound();

  let analysis: ExperimentAnalysis | null = null;
  let analysisError: string | null = null;
  if (e.status === "RUNNING" || e.status === "COMPLETED") {
    try {
      analysis = await ExperimentService.analyze(prisma, e.id);
    } catch (err) {
      analysisError = String((err as Error).message ?? err);
    }
  }
  const totalAssignments = e.variants.reduce((s, v) => s + v.assignedCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={e.title}
        subtitle={`${e.client?.businessName ?? "Internal"} · ${e.campaign?.name ?? "—"} · ${e.kpi}`}
        breadcrumbs={[{ label: "Experiments", href: "/app/experiments" }, { label: e.title }]}
        right={
          <div className="flex items-center gap-2">
            <Badge variant={statusTone(e.status)}>{e.status}</Badge>
            {e.winnerVariantId && (
              <Badge variant="success">Winner declared</Badge>
            )}
          </div>
        }
      />

      {/* Hypothesis + setup */}
      <Card>
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Hypothesis</h3>
        <p className="italic text-ink-700">"{e.hypothesis}"</p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-ink-600">
          <div><span className="text-ink-500">Variable:</span> <code className="text-ink-900">{e.variable}</code></div>
          <div><span className="text-ink-500">Metric:</span> <code className="text-ink-900">{e.metric}</code></div>
          <div><span className="text-ink-500">Audience:</span> {e.audience ?? "—"}</div>
          <div><span className="text-ink-500">Min sample:</span> {e.minSampleSize}/variant</div>
          <div><span className="text-ink-500">Started:</span> {fmtDate(e.startedAt)}</div>
          <div><span className="text-ink-500">Completed:</span> {fmtDate(e.completedAt)}</div>
          <div><span className="text-ink-500">Budget:</span> {e.budget ? fmtINR(e.budget) : "—"}</div>
          <div><span className="text-ink-500">Duration:</span> {e.durationDays} days</div>
        </div>
      </Card>

      {/* Action buttons */}
      <Card>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">Lifecycle</h3>
          <div className="flex flex-wrap gap-2">
            {e.status === "PLANNED" && (
              <form action={transition}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="action" value="start" />
                <button className="btn btn-primary btn-sm">▶ Start experiment</button>
              </form>
            )}
            {e.status === "RUNNING" && (
              <>
                <form action={transition} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="action" value="complete" />
                  <input
                    name="conclusion"
                    placeholder="(optional) one-line conclusion"
                    className="input input-sm w-72"
                  />
                  <button className="btn btn-secondary btn-sm">Complete & declare winner</button>
                </form>
                <form action={transition}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="action" value="cancel" />
                  <button className="btn btn-ghost btn-sm">Cancel</button>
                </form>
              </>
            )}
            {e.status === "PLANNED" && (
              <form action={transition}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="action" value="cancel" />
                <button className="btn btn-ghost btn-sm">Cancel</button>
              </form>
            )}
            {e.status === "COMPLETED" && e.winnerVariantId && (
              <form action={transition}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="action" value="promote" />
                <button className="btn btn-primary btn-sm">↑ Promote winner to Strategy</button>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* Variant cards */}
      <SectionHeader title="Variants" description={`${totalAssignments.toLocaleString("en-IN")} leads bucketed so far`} />
      <div className="grid md:grid-cols-2 gap-4">
        {e.variants.map((v) => {
          const stats: VariantStats | undefined = analysis?.variants.find((s) => s.variantId === v.id);
          const isWinner = analysis?.winner?.variantId === v.id;
          const isControl = v.kind === "CONTROL";
          return (
            <Card key={v.id} className={isWinner ? "ring-2 ring-emerald-400/50" : ""}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink-500">{isControl ? "Control" : "Treatment"}</div>
                  <div className="text-lg font-semibold text-ink-900 mt-0.5">{v.label}</div>
                </div>
                {isWinner && <Badge variant="success">Winner</Badge>}
                {isControl && v.kind === "CONTROL" && !isWinner && (
                  <Badge variant="neutral">Baseline</Badge>
                )}
              </div>
              {v.config && (
                <pre className="text-xs bg-ink-50 p-2 rounded mb-3 overflow-x-auto">{v.config}</pre>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-ink-500">Assigned</div>
                  <div className="text-base font-semibold">{v.assignedCount.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="text-ink-500">Converted</div>
                  <div className="text-base font-semibold">{v.convertedCount.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="text-ink-500">Revenue</div>
                  <div className="text-base font-semibold">{fmtINR(v.revenueTotal)}</div>
                </div>
              </div>
              {stats && (
                <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-500">Rate (Bayes posterior)</span>
                      <span className="font-mono font-semibold">{fmtPct(stats.posteriorMean, 1)}</span>
                    </div>
                    <div className="mt-1 h-2 bg-ink-100 rounded overflow-hidden relative">
                      <div
                        className={isWinner ? "h-full bg-emerald-500" : isControl ? "h-full bg-ink-500" : "h-full bg-brand-500"}
                        style={{ width: `${Math.min(stats.posteriorMean * 100 * 5, 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5 font-mono">
                      95% CI: [{fmtPct(stats.credibleInterval[0], 1)}, {fmtPct(stats.credibleInterval[1], 1)}]
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">P(best)</span>
                    <span className="font-mono font-semibold">{fmtPct(stats.probOfBeingBest, 1)}</span>
                  </div>
                  {!isControl && stats.liftVsControl !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-500">Lift vs control</span>
                      <span className={`font-mono font-semibold ${stats.liftVsControl > 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {stats.liftVsControl > 0 ? "+" : ""}{(stats.liftVsControl * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Analysis verdict */}
      {analysis && (
        <Card className={analysis.canDeclareWinner ? "border-emerald-300 bg-emerald-50/30" : "border-amber-300 bg-amber-50/20"}>
          <h3 className="text-sm font-semibold text-ink-700">Verdict</h3>
          <p className="text-sm text-ink-700 mt-1">{analysis.reason}</p>
          <p className="text-[11px] text-ink-500 mt-2 font-mono">
            Bayesian beta-binomial, {analysis.samples} Monte-Carlo samples · prior Beta(1,1)
          </p>
        </Card>
      )}
      {!analysis && analysisError && (
        <Card className="border-red-300 bg-red-50/30">
          <h3 className="text-sm font-semibold text-ink-700">Analysis error</h3>
          <p className="text-sm text-ink-700 mt-1">{analysisError}</p>
        </Card>
      )}

      {/* Conclusion (filled after COMPLETED) */}
      {(e.status === "COMPLETED" || e.status === "CANCELLED") && (
        <Card>
          <h3 className="text-sm font-semibold text-ink-700">Conclusion</h3>
          <p className="text-sm text-ink-700 mt-1">{e.conclusion ?? "(no conclusion recorded)"}</p>
        </Card>
      )}
    </div>
  );
}

function statusTone(s: string): "neutral" | "brand" | "success" | "warning" | "danger" {
  if (s === "RUNNING") return "brand";
  if (s === "COMPLETED") return "success";
  if (s === "CANCELLED") return "danger";
  return "neutral";
}
