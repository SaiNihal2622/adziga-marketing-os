// Adziga — /app/experiments/impact
// Sprint 15e — cross-client experiment impact dashboard.
// Aggregates per-experiment incremental revenue estimates into one view.

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { ExperimentService } from "@/server/services/experiment-service";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  experimentId: string;
  title: string;
  status: string;
  clientName: string | null;
  winnerLabel: string | null;
  totalAssigned: number;
  totalConverted: number;
  totalRevenue: number;
  incrementalRevenue: number;
  winnerConversionRate: number;
  controlConversionRate: number;
  durationDays: number | null;
};

export default async function ExperimentImpactPage() {
  const session = await requireSession();

  // Pull every COMPLETED/RUNNING experiment in the org and compute
  // per-variant revenue + incremental estimate using ExperimentService.
  const experiments = await prisma.experiment.findMany({
    where: { orgId: session.orgId, status: { in: ["COMPLETED", "RUNNING"] } },
    include: {
      client: { select: { businessName: true } },
      variants: { orderBy: { id: "asc" } }
    },
    orderBy: { completedAt: "desc" }
  });

  const rows: Row[] = [];
  for (const e of experiments) {
    let winnerLabel: string | null = null;
    let winnerConversionRate = 0;
    let controlConversionRate = 0;
    let incrementalRevenue: number | null = null;
    let totalAssigned = 0;
    let totalConverted = 0;
    let totalRevenue = 0;

    try {
      const analysis = await ExperimentService.analyze(prisma, e.id);
      winnerLabel = analysis.winner?.label ?? null;
      totalAssigned = e.variants.reduce((s, v) => s + v.assignedCount, 0);
      totalConverted = e.variants.reduce((s, v) => s + v.convertedCount, 0);
      totalRevenue = e.variants.reduce((s, v) => s + v.revenueTotal, 0);

      for (const v of analysis.variants) {
        if (v.kind === "CONTROL") controlConversionRate = v.posteriorMean;
        if (analysis.winner && v.variantId === analysis.winner.variantId) winnerConversionRate = v.posteriorMean;
      }

      const control = e.variants.find((v) => v.kind === "CONTROL");
      const winnerVariant = analysis.winner
        ? e.variants.find((v) => v.id === analysis.winner!.variantId)
        : null;
      if (winnerVariant && control && control.assignedCount > 0 && winnerVariant.assignedCount > 0) {
        const wRevPerAssign = winnerVariant.revenueTotal / winnerVariant.assignedCount;
        const cRevPerAssign = control.revenueTotal / control.assignedCount;
        incrementalRevenue = (winnerVariant.assignedCount + control.assignedCount) * (wRevPerAssign - cRevPerAssign);
      }
    } catch {
      // ignore — leave defaults
    }

    rows.push({
      experimentId: e.id,
      title: e.title,
      status: e.status,
      clientName: e.client?.businessName ?? null,
      winnerLabel,
      totalAssigned,
      totalConverted,
      totalRevenue,
      incrementalRevenue: incrementalRevenue ?? 0,
      winnerConversionRate,
      controlConversionRate,
      durationDays: e.durationDays
    });
  }

  const totalIncremental = rows.reduce((s, r) => s + (r.incrementalRevenue > 0 ? r.incrementalRevenue : 0), 0);
  const winners = rows.filter((r) => r.winnerLabel).length;
  const withData = rows.filter((r) => r.totalAssigned >= 30).length;
  const avgLift = rows.filter((r) => r.controlConversionRate > 0).length > 0
    ? rows.filter((r) => r.controlConversionRate > 0).reduce((s, r) => s + (r.winnerConversionRate - r.controlConversionRate), 0) / rows.filter((r) => r.controlConversionRate > 0).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiments — impact dashboard"
        subtitle="Cross-client aggregate of A/B test outcomes. Each row shows how the winner compares to control and the estimated incremental revenue at current traffic volume."
        eyebrow="Marketing OS"
        breadcrumbs={[
          { label: "Experiments", href: "/app/experiments" },
          { label: "Impact" }
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Experiments (active/complete)" value={fmtNum(rows.length)} />
        <Kpi label="Winners declared" value={fmtNum(winners)} />
        <Kpi label="Avg lift vs control" value={fmtPct(avgLift, 1)} tone={avgLift > 0 ? "success" : avgLift < 0 ? "accent" : "neutral"} />
        <Kpi
          label="Est. monthly incremental"
          value={fmtINR(totalIncremental)}
          tone={totalIncremental > 0 ? "success" : "neutral"}
          hint="sum across winners"
        />
      </div>

      <SectionHeader title="Per experiment" description={`${rows.length} experiments with statistical data`} />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Experiment</th>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-left px-4 py-2">Winner</th>
                <th className="text-right">Assigned</th>
                <th className="text-right">Converted</th>
                <th className="text-right">Win rate</th>
                <th className="text-right">Ctrl rate</th>
                <th className="text-right">Lift</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Incremental</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.experimentId} className="border-b border-ink-100 hover:bg-ink-50/40">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/app/experiments/${r.experimentId}`} className="hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-[10px] text-ink-500 mt-0.5">
                      <Badge variant={r.status === "COMPLETED" ? "success" : "brand"}>{r.status}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-700">{r.clientName ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.winnerLabel ? (
                      <Badge variant="success">{r.winnerLabel}</Badge>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmtNum(r.totalAssigned)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtNum(r.totalConverted)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.winnerConversionRate, 1)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.controlConversionRate, 1)}</td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${
                    r.winnerConversionRate > r.controlConversionRate ? "text-emerald-700" : r.winnerConversionRate < r.controlConversionRate ? "text-rose-700" : "text-ink-700"
                  }`}>
                    {r.controlConversionRate > 0
                      ? `${((r.winnerConversionRate - r.controlConversionRate) * 100).toFixed(1)}pp`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(r.totalRevenue)}</td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${r.incrementalRevenue > 0 ? "text-emerald-700" : "text-ink-500"}`}>
                    {r.incrementalRevenue > 0 ? `+${fmtINR(r.incrementalRevenue)}` : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-ink-500 py-6">
                    No completed or running experiments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionHeader title="How we compute incremental" />
      <Card>
        <p className="text-xs text-ink-600">
          For each experiment with a declared winner, we compute revenue per assignment for both the winner and the control variant. The difference,
          scaled to combined traffic volume, gives an estimated monthly incremental revenue if the winner were deployed across the campaign's full spend.
        </p>
      </Card>
    </div>
  );
}
