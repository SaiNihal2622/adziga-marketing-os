// Adziga — /app/analytics/funnel
// Org-wide funnel with drop-off detection + period-over-period diff.
// The "where is the leak" view that drives point 9 of the vision (Diagnose).

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { FunnelChart } from "@/app/app/_components/funnel-chart";
import { fmtINR, fmtNum } from "@/lib/format";
import { FunnelService } from "@/server/services/funnel-service";

export const dynamic = "force-dynamic";

export default async function FunnelAnalyticsPage({
  searchParams
}: {
  searchParams: { clientId?: string; campaignId?: string; days?: string; view?: string };
}) {
  const session = await requireSession();
  const days = searchParams.days ? Math.max(7, Math.min(365, Number(searchParams.days))) : 90;
  const filter = {
    orgId: session.orgId,
    clientId: searchParams.clientId,
    campaignId: searchParams.campaignId,
    windowDays: days
  };

  const [snapshot, diff, clients, campaigns] = await Promise.all([
    FunnelService.snapshot(filter),
    FunnelService.diff(filter).catch(() => null),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } }),
    prisma.campaign.findMany({
      where: { orgId: session.orgId, ...(searchParams.clientId ? { clientId: searchParams.clientId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, platform: true, status: true, client: { select: { businessName: true } } }
    })
  ]);

  function scopeHref(overrides: { clientId?: string | null; campaignId?: string | null }) {
    const p = new URLSearchParams({ days: String(days) });
    if (overrides.clientId !== null && overrides.clientId !== undefined) p.set("clientId", overrides.clientId);
    if (overrides.campaignId !== null && overrides.campaignId !== undefined) p.set("campaignId", overrides.campaignId);
    return `/app/analytics/funnel?${p.toString()}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Funnel"
        subtitle="Impressions → visitors → leads → qualified → customers → revenue. Watch / critical flags mark the leakiest stage."
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "Funnel" }]}
        right={
          <div className="flex items-center gap-1.5">
            {[30, 60, 90, 180].map((d) => (
              <Link
                key={d}
                href={`/app/analytics/funnel?days=${d}${searchParams.clientId ? `&clientId=${searchParams.clientId}` : ""}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  days === d ? "bg-ink-900 text-white" : "bg-white border border-ink-200 text-ink-700 hover:border-ink-300"
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Spend" value={fmtINR(snapshot.spend)} hint={`last ${days}d`} />
        <Kpi label="Customers" value={snapshot.funnel[4]?.value.toLocaleString("en-IN") ?? "0"} tone="success" />
        <Kpi label="CAC" value={fmtINR(snapshot.cac)} tone={snapshot.cac > 0 && snapshot.cac < 1000 ? "success" : "neutral"} hint={`${snapshot.roas.toFixed(2)}× ROAS`} />
        <Kpi
          label="End-to-end"
          value={fmtPct(snapshot.endToEndRate)}
          hint="imp → customer"
          tone={snapshot.endToEndRate >= 0.001 ? "success" : "neutral"}
        />
      </div>

      {/* Scope filters */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mr-2">Client</span>
          <Link href={scopeHref({ clientId: null, campaignId: null })} className={`px-2.5 py-1 rounded-full text-xs font-medium ${!searchParams.clientId ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}>
            All
          </Link>
          {clients.slice(0, 12).map((c) => (
            <Link
              key={c.id}
              href={scopeHref({ clientId: c.id })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${searchParams.clientId === c.id ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
            >
              {c.businessName}
            </Link>
          ))}
        </div>
        {campaigns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mr-2">Campaign</span>
            <Link href={scopeHref({ campaignId: null })} className={`px-2.5 py-1 rounded-full text-xs font-medium ${!searchParams.campaignId ? "bg-charcoal-700 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}>
              All
            </Link>
            {campaigns.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={scopeHref({ campaignId: c.id })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${searchParams.campaignId === c.id ? "bg-charcoal-700 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-8">
        <Card padding="lg">
          <SectionHeader
            title="Marketing funnel"
            description={`Impressions → visitors → leads → qualified → customers → revenue. Last ${days} days.`}
          />
          <FunnelChart
            stages={snapshot.funnel}
            currency
            fmtValue={(n) => fmtINR(n)}
          />
        </Card>

        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold">Diagnosis</div>
            {snapshot.worstStage && snapshot.worstStage.severity > 0 && (
              <Badge variant={snapshot.worstStage.severity === 2 ? "danger" : "warning"} dot>
                Leak detected
              </Badge>
            )}
          </div>

          {snapshot.worstStage && snapshot.worstStage.severity > 0 ? (
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-ink-900 mb-1">
                {snapshot.worstStage.label} is the leakiest stage.
              </div>
              <div className="text-sm text-ink-600 leading-relaxed">
                Only <strong>{fmtPct(snapshot.worstStage.conversionRate ?? 0)}</strong> of leads from the previous stage reach this one — dropping{" "}
                {snapshot.worstStage.dropOff !== null ? fmtNum(snapshot.worstStage.dropOff) : "0"} units.
              </div>
              <div className="mt-4 pt-4 border-t border-ink-100 space-y-2">
                <Hypothesis stage={snapshot.worstStage.key} />
              </div>
              <div className="mt-4 pt-4 border-t border-ink-100 flex flex-wrap items-center gap-2">
                <Link href={`/app/ai${searchParams.clientId ? `?clientId=${searchParams.clientId}` : ""}`}>
                  <Button size="sm" variant="primary">Diagnose with AI</Button>
                </Link>
                {searchParams.clientId && (
                  <Link href={`/app/clients/${searchParams.clientId}/command-center`}>
                    <Button size="sm" variant="outline">Command Center</Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-ink-900 mb-1">No major leak detected.</div>
              <div className="text-sm text-ink-600 leading-relaxed">
                All conversion stages are within benchmark. Keep feeding the system — attribution rollups get sharper with more conversions.
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Period-over-period */}
      {diff && (
        <>
          <SectionHeader
            title="What changed"
            description={`Comparing last ${days}d to the previous ${Math.floor(days / 2)}d window.`}
          />
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Stage</th>
                  <th className="px-5 py-2.5 text-right">Current</th>
                  <th className="px-5 py-2.5 text-right">Previous</th>
                  <th className="px-5 py-2.5 text-right">Value Δ</th>
                  <th className="px-5 py-2.5 text-right">Rate Δ</th>
                  <th className="px-5 py-2.5">Trend</th>
                </tr>
              </thead>
              <tbody>
                {diff.current.funnel.map((s, i) => {
                  const prev = diff.previous.funnel[i];
                  const d = diff.deltas[i];
                  const valueDelta = d.valueDelta;
                  const rateDelta = d.rateDelta;
                  return (
                    <tr key={s.key} className="border-t border-ink-100">
                      <td className="px-5 py-3 font-medium text-ink-900">{s.label}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {s.key === "revenue" ? fmtINR(s.value) : fmtNum(s.value)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink-500">
                        {prev ? (prev.key === "revenue" ? fmtINR(prev.value) : fmtNum(prev.value)) : "—"}
                      </td>
                      <td className={`px-5 py-3 text-right tabular-nums ${valueDelta > 0 ? "text-emerald-700" : valueDelta < 0 ? "text-rose-700" : "text-ink-500"}`}>
                        {valueDelta > 0 ? "+" : ""}
                        {s.key === "revenue" ? fmtINR(valueDelta) : fmtNum(valueDelta)}
                      </td>
                      <td className={`px-5 py-3 text-right tabular-nums ${rateDelta !== null ? (rateDelta > 0 ? "text-emerald-700" : rateDelta < 0 ? "text-rose-700" : "text-ink-500") : "text-ink-300"}`}>
                        {rateDelta !== null ? `${(rateDelta * 100).toFixed(2)}pp` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Sparkline
                          current={s.value}
                          previous={prev?.value ?? 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Sparkline({ current, previous }: { current: number; previous: number }) {
  // Two-bar micro chart
  const max = Math.max(1, current, previous);
  const currPct = (current / max) * 100;
  const prevPct = (previous / max) * 100;
  return (
    <div className="flex items-end gap-1 h-5 w-24">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-3 bg-ink-200 rounded-sm" style={{ height: `${prevPct}%` }} />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-3 bg-brand-500 rounded-sm" style={{ height: `${currPct}%` }} />
      </div>
    </div>
  );
}

function Hypothesis({ stage }: { stage: string }) {
  const hypotheses: Record<string, string[]> = {
    visitors: [
      "Creative fatigue: impressions constant but clicks dropping — frequency too high, audience saw the same ad too often.",
      "Targeting too narrow: audience exhausted, expand interest stack.",
      "Ad placement shift: Meta rebalancing budgets, check Auction Insights."
    ],
    leads: [
      "Landing-page conversion regressed — check load speed, mobile experience, form length.",
      "Offer mismatch: ad promises X, landing delivers Y.",
      "Lead form friction: too many fields, weak CTA copy, page slow on 3G."
    ],
    qualified: [
      "Lead scoring rule stale: leads marked qualified are actually low-intent.",
      "Sales response time slow: hot leads cool off before first contact.",
      "Audience targeting wrong: attracting curiosity-seekers, not buyers."
    ],
    customers: [
      "Sales process has friction: pricing objections, missing objection handling.",
      "Lead → customer conversion rule needs tuning: re-evaluate qualification criteria.",
      "Pricing or offer misalignment: leads don't convert because offer doesn't fit their situation."
    ]
  };
  const list = hypotheses[stage] ?? ["Investigate the upstream campaigns for that stage."];
  return (
    <ul className="space-y-2">
      {list.map((h, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-ink-700 leading-relaxed">
          <span className="inline-flex items-center justify-center size-4 rounded-full bg-ink-100 text-ink-700 text-[10px] font-semibold shrink-0 mt-0.5">{i + 1}</span>
          <span>{h}</span>
        </li>
      ))}
    </ul>
  );
}

function fmtPct(n: number): string {
  if (n < 0.001 && n > 0) return `${(n * 100).toFixed(3)}%`;
  return `${(n * 100).toFixed(2)}%`;
}
