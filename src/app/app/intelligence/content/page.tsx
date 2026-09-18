import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { KpiCard } from "../../_components/widgets";
import { fmtINR, fmtPct } from "@/lib/format";
import { ContentControls } from "./controls";

export const dynamic = "force-dynamic";

export default async function ContentIntelligencePage() {
  const session = await requireSession();
  const patterns = await prisma.contentPattern.findMany({
    where: { orgId: session.orgId },
    orderBy: [{ confidence: "desc" }, { roas: "desc" }]
  });

  const byType: Record<string, typeof patterns> = {};
  for (const p of patterns) {
    if (!byType[p.patternType]) byType[p.patternType] = [];
    byType[p.patternType].push(p);
  }

  const strong = patterns.filter((p) => p.confidence > 0.6).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Intelligence"
        subtitle="Analyzes your creative library to find hooks, formats, CTAs, and platforms that correlate with business outcomes."
        breadcrumbs={[{ label: "Intelligence", href: "/app/intelligence" }, { label: "Content" }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Patterns analyzed" value={patterns.length.toString()} sub="Across all categories" />
        <KpiCard label="High confidence" value={strong.toString()} sub="Confidence > 60%" />
        <KpiCard label="Total spend analyzed" value={fmtINR(patterns.reduce((s, p) => s + p.totalSpend, 0))} />
        <KpiCard label="Total leads analyzed" value={patterns.reduce((s, p) => s + p.totalLeads, 0).toString()} />
      </div>

      <ContentControls />

      {Object.keys(byType).length === 0 && (
        <div className="card p-10 text-center text-ink-500">
          No patterns yet. Click "Recompute" above to analyze your creative library.
        </div>
      )}

      {Object.entries(byType).map(([type, items]) => (
        <div key={type} className="card overflow-hidden">
          <h3 className="text-sm font-semibold text-ink-700 p-4 capitalize">
            {type} patterns ({items.length})
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th className="text-right">Used</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Leads</th>
                <th className="text-right">CPL</th>
                <th className="text-right">CTR</th>
                <th className="text-right">ROAS</th>
                <th>Confidence</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.pattern.length > 60 ? p.pattern.slice(0, 60) + "..." : p.pattern}</td>
                  <td className="text-right text-xs">{p.appearances}</td>
                  <td className="text-right font-mono text-xs">{fmtINR(p.totalSpend)}</td>
                  <td className="text-right font-mono text-xs">{p.totalLeads}</td>
                  <td className="text-right font-mono text-xs">{p.cpl > 0 ? fmtINR(p.cpl) : "-"}</td>
                  <td className="text-right font-mono text-xs">{fmtPct(p.ctr)}</td>
                  <td className="text-right font-mono text-xs">{p.roas > 0 ? `${p.roas.toFixed(1)}x` : "-"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-ink-100 rounded">
                        <div className={`h-1.5 rounded ${p.confidence > 0.6 ? "bg-emerald-500" : p.confidence > 0.4 ? "bg-amber-500" : "bg-ink-300"}`} style={{ width: `${p.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs">{Math.round(p.confidence * 100)}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${p.verdict === "strong" ? "badge-success" : p.verdict === "promising" ? "badge-brand" : p.verdict === "weak" ? "badge-danger" : "badge-neutral"}`}>
                      {p.verdict ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}