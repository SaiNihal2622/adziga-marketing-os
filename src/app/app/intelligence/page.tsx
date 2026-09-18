import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { KpiCard } from "../_components/widgets";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IntelligenceHome() {
  const session = await requireSession();
  const [contentPatterns, strategyRecs, benchmarks, integrations] = await Promise.all([
    prisma.contentPattern.count({ where: { orgId: session.orgId } }),
    prisma.strategyRecommendation.count({ where: { orgId: session.orgId } }),
    prisma.industryBenchmark.count(),
    prisma.integration.findMany({ where: { orgId: session.orgId } })
  ]);

  const strong = await prisma.contentPattern.count({
    where: { orgId: session.orgId, confidence: { gt: 0.6 } }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence"
        subtitle="Phase 2 (Strategy) + Phase 3 (Content) intelligence layer. Computed from your real campaign data + industry benchmarks. Every recommendation is confidence-scored."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Content patterns" value={fmtNum(contentPatterns)} sub={`${strong} with high confidence`} />
        <KpiCard label="Strategy recs" value={fmtNum(strategyRecs)} sub="Generated from your data" />
        <KpiCard label="Benchmarks" value={fmtNum(benchmarks)} sub="Industry ?? channel ?? objective" />
        <KpiCard label="Integrations" value={`${integrations.filter((i) => i.status === "HEALTHY").length}/${integrations.length}`} sub="Healthy" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/app/intelligence/strategy" className="card p-6 hover:shadow-md block">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-brand-600 font-semibold uppercase tracking-wide">Phase 2</div>
              <h3 className="text-lg font-semibold mt-1">Strategy Intelligence</h3>
              <p className="text-sm text-ink-600 mt-2">
                Given business ?? audience ?? budget, what configuration historically produces the best outcome?
                Uses 70% your history + 30% industry benchmarks.
              </p>
            </div>
            <div className="text-3xl"></div>
          </div>
          <div className="mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
            <span className="font-mono bg-ink-50 px-2 py-1 rounded">adziga-strategy-v1</span>
          </div>
        </Link>

        <Link href="/app/intelligence/content" className="card p-6 hover:shadow-md block">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-accent-600 font-semibold uppercase tracking-wide">Phase 3</div>
              <h3 className="text-lg font-semibold mt-1">Content Intelligence</h3>
              <p className="text-sm text-ink-600 mt-2">
                Analyzes every creative in your library to find patterns that correlate with business outcomes.
                Recommends format / hook / CTA per channel + goal.
              </p>
            </div>
            <div className="text-3xl"></div>
          </div>
          <div className="mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
            <span className="font-mono bg-ink-50 px-2 py-1 rounded">adziga-content-v1</span>
          </div>
        </Link>
      </div>

      <div className="card p-6 bg-ink-50 border-ink-200">
        <h3 className="text-sm font-semibold text-ink-700 mb-2">How intelligence works</h3>
        <ul className="text-sm text-ink-700 space-y-2">
          <li>1. <strong>No fake AI.</strong> All recommendations are computed from real data + benchmarks, never invented.</li>
          <li>2. <strong>Confidence scoring.</strong> Every recommendation shows how reliable it is (0-1).</li>
          <li>3. <strong>70/30 blending.</strong> Your historical performance is weighted higher than industry averages.</li>
          <li>4. <strong>Audit trail.</strong> Every recommendation is persisted with full reasoning.</li>
          <li>5. <strong>No autonomous action.</strong> Recommendations become reality only through the Approval workflow.</li>
        </ul>
      </div>
    </div>
  );
}