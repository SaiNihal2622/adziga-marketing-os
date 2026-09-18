import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { KpiCard } from "../../_components/widgets";
import { fmtINR, fmtPct, fmtDateTime, relTime } from "@/lib/format";
import { RecommendForm } from "./recommend-form";

export const dynamic = "force-dynamic";

export default async function StrategyIntelligencePage() {
  const session = await requireSession();
  const [recs, benchmarks, clients] = await Promise.all([
    prisma.strategyRecommendation.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.industryBenchmark.findMany({ take: 100 }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy Intelligence"
        subtitle="Given business x audience x budget -> recommended channel allocation. Blends your historical data with industry benchmarks."
        breadcrumbs={[{ label: "Intelligence", href: "/app/intelligence" }, { label: "Strategy" }]}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Generate recommendation</h3>
          <RecommendForm clients={clients.map((c) => ({ id: c.id, name: c.businessName, industry: c.industry }))} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Industry benchmarks</h3>
          <p className="text-sm text-ink-600 mb-3">
            Database of {benchmarks.length} industry x objective x channel benchmarks.
            Used as the 30% prior in blended recommendations.
          </p>
          <div className="space-y-1.5 text-xs">
            {benchmarks.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between">
                <div className="truncate">{b.industry} / {b.objective} / {b.channel}</div>
                <div className="font-mono">INR {b.cplMedian.toFixed(0)}</div>
              </div>
            ))}
            {benchmarks.length > 5 && (
              <div className="text-ink-400">+ {benchmarks.length - 5} more</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-700">Recent recommendations ({recs.length})</h3>
        {recs.length === 0 && <p className="text-sm text-ink-500 card p-6 text-center">No recommendations yet. Run one above.</p>}
        {recs.map((r) => {
          const channels = JSON.parse(r.recommendedChannels);
          const reasoning = JSON.parse(r.reasoning);
          return (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-ink-500">
                    {r.industry} / {r.objective} / {fmtINR(r.monthlyBudget)} monthly budget / {fmtDateTime(r.createdAt)}
                  </div>
                  <div className="font-semibold mt-1">
                    Expected CPL INR {r.expectedCpl.toFixed(0)} - CAC INR {r.expectedCac.toFixed(0)} - ROAS {r.expectedRoas.toFixed(2)}x
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${r.confidence > 0.7 ? "badge-success" : r.confidence > 0.5 ? "badge-warning" : "badge-neutral"}`}>
                    {(r.confidence * 100).toFixed(0)}% conf
                  </span>
                  <span className="badge badge-neutral">{r.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {channels.map((c: any, i: number) => (
                  <div key={i} className="bg-ink-50 rounded p-2">
                    <div className="text-xs font-semibold">{c.platform}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{c.allocationPct}% allocation</div>
                    <div className="text-xs font-mono mt-1">~INR {c.expectedCpl} CPL</div>
                  </div>
                ))}
              </div>
              {reasoning?.notes && reasoning.notes.length > 0 && (
                <div className="text-xs text-ink-600 border-t border-ink-100 pt-2">
                  <strong>Notes:</strong> {reasoning.notes.join(" / ")}
                </div>
              )}
              {reasoning?.basedOnSample > 0 && (
                <div className="text-xs text-ink-500 mt-1">
                  Based on {reasoning.basedOnSample} similar campaigns from your history.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}