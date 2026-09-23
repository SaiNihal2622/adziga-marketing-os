// Adziga — /app/analytics/calibration
// Sprint 18a — predictive model self-evaluation dashboard. Compares
// what the PredictiveOutcomeModel says today against what actually
// happened on each campaign over the last 90 days.

import { CalibrationService } from "@/server/services/calibration-service";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { RecomputeCalibrationButton } from "./_recompute-button";

export const dynamic = "force-dynamic";

export default async function CalibrationPage({
  searchParams
}: {
  searchParams: { days?: string };
}) {
  const session = await requireSession();
  const windowDays = Number(searchParams.days) || 90;

  const snap = await CalibrationService.evaluate(session.orgId, windowDays);

  const overallBiasTone:
    | "neutral"
    | "brand"
    | "success"
    | "accent"
    | undefined =
    Math.abs(snap.overallBias) < 0.1
      ? "neutral"
      : snap.overallBias > 0
        ? "accent"
        : "brand";
  const overallBiasLabel =
    snap.overallBias > 0
      ? "Under-predicts"
      : snap.overallBias < 0
        ? "Over-predicts"
        : "Calibrated";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing OS"
        title="Predictive-model calibration"
        subtitle={`Re-runs the predictive model against historical campaigns to surface where it over- or under-shoots. Last ${windowDays} days · ${snap.computedAt.slice(0, 16).replace("T", " ")} UTC`}
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "Calibration" }]}
        right={
          <div className="flex items-center gap-2">
            <Badge variant={overallBiasTone}>{overallBiasLabel}</Badge>
            <RecomputeCalibrationButton days={windowDays} />
          </div>
        }
      />

      {snap.note && (
        <Card padding="md" className="border-amber-300 bg-amber-50/40">
          <p className="text-sm text-amber-900">{snap.note}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Campaigns evaluated" value={String(snap.coveredCampaigns)} hint={`out of ${snap.totalCampaignsEvaluated} with spend+leads`} />
        <Kpi label="Overall MAPE" value={fmtPct(snap.overallMape)} hint="mean absolute % error" tone={snap.overallMape > 0.5 ? "accent" : "neutral"} />
        <Kpi label="Overall bias" value={fmtPct(snap.overallBias)} hint={overallBiasLabel} tone={overallBiasTone} />
        <Kpi label="Window" value={`${windowDays}d`} hint="rolling evaluation" />
      </div>

      <SectionHeader title="By platform" description="Where the model is calibrated (low bias) and where it needs attention." />
      <Card padding="none">
        {snap.byPlatform.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">No platform data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3 text-right">n</th>
                <th className="px-4 py-3 text-right">Predicted CPL</th>
                <th className="px-4 py-3 text-right">Actual CPL</th>
                <th className="px-4 py-3 text-right">MAPE</th>
                <th className="px-4 py-3 text-right">Median err</th>
                <th className="px-4 py-3 text-right">Bias</th>
                <th className="px-4 py-3 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {snap.byPlatform.map((b) => (
                <tr key={b.key} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{b.key}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700">{b.n}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtINR(b.meanPredictedCpl)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-900 tabular-nums">{fmtINR(b.meanActualCpl)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtPct(b.mape)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtPct(b.medianAbsErrorRatio)}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${biasTone(b.bias)}`}>
                    {fmtPct(b.bias)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <Verdict bucket={b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SectionHeader title="By industry" description="Industries where predictions hold up vs where they drift." />
      <Card padding="none">
        {snap.byIndustry.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            Set client industries to populate this section.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3 text-right">n</th>
                <th className="px-4 py-3 text-right">Predicted CPL</th>
                <th className="px-4 py-3 text-right">Actual CPL</th>
                <th className="px-4 py-3 text-right">MAPE</th>
                <th className="px-4 py-3 text-right">Bias</th>
                <th className="px-4 py-3 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {snap.byIndustry.map((b) => (
                <tr key={b.key} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{b.key}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700">{b.n}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtINR(b.meanPredictedCpl)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-900 tabular-nums">{fmtINR(b.meanActualCpl)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtPct(b.mape)}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${biasTone(b.bias)}`}>
                    {fmtPct(b.bias)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <Verdict bucket={b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SectionHeader title="Worst-predicted campaigns" description="Top 25 campaigns where the model's CPL was furthest from reality." />
      <Card padding="none">
        {snap.rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">No campaigns to show.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">Predicted CPL</th>
                  <th className="px-4 py-3 text-right">Actual CPL</th>
                  <th className="px-4 py-3 text-right">Error</th>
                  <th className="px-4 py-3 text-right">Bias</th>
                </tr>
              </thead>
              <tbody>
                {snap.rows.slice(0, 25).map((r) => (
                  <tr key={r.campaignId} className="border-t border-ink-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900 truncate max-w-[260px]" title={r.campaignName}>{r.campaignName}</div>
                      <div className="text-[10px] text-ink-500 font-mono">{r.industry}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <a href={`/app/clients/${r.clientId}`} className="text-ink-700 hover:underline">{r.clientName}</a>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{r.platform}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-700 tabular-nums">{fmtINR(r.predictedCpl)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-900 font-semibold tabular-nums">{fmtINR(r.actualCpl)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPct(r.absErrorRatio)}</td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${biasTone(r.signedErrorRatio)}`}>
                      {fmtPct(r.signedErrorRatio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Verdict({ bucket }: { bucket: { mape: number; bias: number; n: number } }) {
  if (bucket.n < 3) return <span className="text-ink-400">low sample</span>;
  if (bucket.mape < 0.2 && Math.abs(bucket.bias) < 0.15) return <Badge variant="success">Calibrated</Badge>;
  if (bucket.mape < 0.4) return <Badge variant="info">Acceptable</Badge>;
  if (bucket.mape < 0.7) return <Badge variant="warning">Drifting</Badge>;
  return <Badge variant="danger">Mis-calibrated</Badge>;
}

function biasTone(bias: number): string {
  if (Math.abs(bias) < 0.1) return "text-ink-700";
  if (bias > 0) return "text-amber-700"; // predicts lower than actual = optimistic
  return "text-sky-700"; // predicts higher than actual = pessimistic
}
