// Adziga — /app/analytics/anomalies
// Sprint 9b — campaign anomaly detection UI with auto-pause suggestions.

import { CampaignAnomalyService } from "@/server/services/campaign-anomaly-service";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [7, 14, 30, 60] as const;

export default async function AnomaliesPage({
  searchParams
}: {
  searchParams: { days?: string; rec?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 30;
  const recFilter = (searchParams.rec ?? "").trim();

  const all = await CampaignAnomalyService.detectForOrg(session.orgId, days);
  const filtered = recFilter ? all.filter((a) => a.recommendAction === recFilter) : all;

  const counts = {
    pause: all.filter((a) => a.recommendAction === "pause").length,
    watch: all.filter((a) => a.recommendAction === "watch").length,
    scale: all.filter((a) => a.recommendAction === "scale").length,
    none: all.filter((a) => a.recommendAction === "none").length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign anomalies"
        subtitle="Per-campaign drift detection with auto-pause suggestions. Z-score based rolling baseline; pauses recommended for sustained CPL spikes."
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "Anomalies" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-1">Window:</span>
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`?days=${d}${recFilter ? `&rec=${recFilter}` : ""}`}
                className={`px-2 py-1 rounded ${days === d ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Auto-pause" value={counts.pause} hint="candidates" tone={counts.pause > 0 ? "accent" : "neutral"} />
        <Kpi label="Watch" value={counts.watch} hint="anomalies within threshold" tone="neutral" />
        <Kpi label="Scale" value={counts.scale} hint="efficient period detected" tone="success" />
        <Kpi label="Healthy" value={counts.none} hint="no anomalies" />
      </div>

      {/* Recommendation filter */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Filter:</span>
        <Link
          href={`?days=${days}`}
          className={`px-3 py-1 rounded ${!recFilter ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
        >
          All
        </Link>
        {(["pause", "watch", "scale", "none"] as const).map((r) => (
          <Link
            key={r}
            href={`?days=${days}&rec=${r}`}
            className={`px-3 py-1 rounded ${recFilter === r ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
          >
            {r} ({counts[r]})
          </Link>
        ))}
      </div>

      <SectionHeader title={`Campaigns${recFilter ? ` · ${recFilter}` : ""}`} description={`Last ${days} days`} />

      {/* What-if simulator — uses last 30 days as baseline */}
      <div className="mb-4 flex items-center gap-4">
        <Link href="/app/analytics/anomalies/simulate" className="text-xs text-brand-600 hover:underline">
          Open full what-if simulator →
        </Link>
        <Link href="/app/admin/anomalies/thresholds" className="text-xs text-brand-600 hover:underline">
          Tune thresholds →
        </Link>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <p className="text-sm text-ink-500 text-center py-8">
              No campaigns match this filter. Either no active campaigns exist or none have any detected anomaly.
            </p>
          </Card>
        )}
        {filtered.map((c) => (
          <Card key={c.campaignId} className={c.recommendAction === "pause" ? "border-rose-300 bg-rose-50/30" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={recVariant(c.recommendAction)}>{c.recommendAction.toUpperCase()}</Badge>
                  <Link href={`/app/campaigns/${c.campaignId}`} className="font-semibold text-ink-900 hover:underline truncate">
                    {c.campaignName}
                  </Link>
                  <span className="text-xs text-ink-500">· {c.platform}</span>
                  {c.clientName && <span className="text-xs text-ink-500">· {c.clientName}</span>}
                </div>
                <p className="text-xs text-ink-600 mt-1.5">{c.reason}</p>
                {!c.hasEnoughHistory && (
                  <p className="text-[10px] text-amber-700 mt-1 font-mono">
                    ⚠ Insufficient ad-spend history. Connect ad-platform sync for reliable anomaly detection.
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-ink-600 shrink-0">
                <div className="text-ink-500">Budget</div>
                <div className="font-mono font-semibold text-ink-900">
                  {fmtINR(c.spent)} / {fmtINR(c.budget ?? 0)}
                </div>
                <div className="text-ink-500 mt-0.5">{c.budgetPct.toFixed(0)}% used</div>
              </div>
            </div>
            {c.metrics.length > 0 && (
              <div className="mt-3 pt-3 border-t border-ink-100 grid md:grid-cols-3 gap-3">
                {c.metrics.slice(0, 3).map((m, i) => (
                  <div key={i} className="rounded-lg bg-ink-50 p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-ink-500 uppercase tracking-wide font-medium">{m.metric}</span>
                      <Badge variant={m.severity === "critical" ? "warning" : m.severity === "warning" ? "accent" : "neutral"}>
                        {m.direction === "spike" ? "↑" : "↓"} {m.deltaPct.toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="font-mono font-semibold text-sm mt-0.5">
                      {m.metric === "cpl" ? fmtINR(m.observed) : fmtNum(m.observed)}
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5">z={m.zScore.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            )}
            {c.recommendAction === "pause" && (
              <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2 text-xs">
                <span className="text-rose-700 font-medium">Auto-pause available:</span>
                <Link href={`/app/admin/auto-approve?campaignId=${c.campaignId}`} className="text-brand-600 hover:underline">
                  Configure auto-approve policy →
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function recVariant(r: string): "neutral" | "brand" | "success" | "accent" | "warning" {
  if (r === "pause") return "warning";
  if (r === "scale") return "success";
  if (r === "watch") return "accent";
  return "neutral";
}
