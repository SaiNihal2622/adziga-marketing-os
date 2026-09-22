// Adziga — /app/analytics/conversion-lag
// Sprint 11a — operational visibility on lead → customer lag.

import { ConversionLagService } from "@/server/services/conversion-lag-service";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtINR, fmtNum } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [30, 60, 90, 180] as const;

export default async function ConversionLagPage({
  searchParams
}: {
  searchParams: { days?: string; clientId?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 90;
  const clientId = searchParams.clientId;

  const report = await ConversionLagService.report(session.orgId, days, clientId);

  // For the client-scope picker.
  const clients = await prisma.client.findMany({
    where: { orgId: session.orgId },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion lag"
        subtitle="Lead → customer lag percentiles broken down by channel. Helps answer 'how fast does a lead actually convert?' and 'does that vary by source?'"
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "Conversion lag" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-1">Window:</span>
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`?days=${d}${clientId ? `&clientId=${clientId}` : ""}`}
                className={`px-2 py-1 rounded ${d === days ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      {/* Client scope picker */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Scope:</span>
        <Link
          href={`?days=${days}`}
          className={`px-3 py-1 rounded ${!clientId ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
        >
          All clients
        </Link>
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`?days=${days}&clientId=${c.id}`}
            className={`px-3 py-1 rounded ${clientId === c.id ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
          >
            {c.businessName}
          </Link>
        ))}
      </div>

      {/* Overall KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="p50 lag" value={report.overall.p50 > 0 ? `${report.overall.p50.toFixed(1)}d` : "—"} hint="median time-lead-to-customer" />
        <Kpi label="p90 lag" value={report.overall.p90 > 0 ? `${report.overall.p90.toFixed(1)}d` : "—"} tone={report.overall.p90 <= 30 ? "success" : report.overall.p90 <= 90 ? "neutral" : "accent"} hint="90% of conversions" />
        <Kpi label="Converted" value={fmtNum(report.overall.n)} hint={`last ${days} days`} />
        <Kpi label="Mean lag" value={report.overall.meanLagDays > 0 ? `${report.overall.meanLagDays.toFixed(1)}d` : "—"} />
        <Kpi label="Avg revenue" value={fmtINR(report.overall.meanRevenue)} hint="per converted customer" />
      </div>

      <SectionHeader title="By platform" description="Sorted by sample size (most-data-first). p50 closer to 0 = faster conversion." />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Platform</th>
                <th className="text-right">n</th>
                <th className="text-right">p25</th>
                <th className="text-right">p50</th>
                <th className="text-right">p75</th>
                <th className="text-right">p90</th>
                <th className="text-right">Mean</th>
                <th className="text-right">Avg revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.byPlatform.map((r) => (
                <tr key={r.platform} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-medium">{r.platform}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.n}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.p25.toFixed(1)}d</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{r.p50.toFixed(1)}d</td>
                  <td className="px-4 py-2 text-right font-mono">{r.p75.toFixed(1)}d</td>
                  <td className="px-4 py-2 text-right font-mono">{r.p90.toFixed(1)}d</td>
                  <td className="px-4 py-2 text-right font-mono text-ink-600">{r.meanLagDays.toFixed(1)}d</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(r.meanRevenue)}</td>
                </tr>
              ))}
              {report.byPlatform.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-ink-500 py-6">
                    No conversions yet in this window. Once leads start winning, lag percentiles will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-ink-700 mb-2">Reading the percentiles</h3>
        <ul className="text-xs text-ink-600 space-y-1">
          <li>
            <strong className="font-mono">p50</strong> = median. Half of converted customers closed within this many days of the lead arriving.
          </li>
          <li>
            <strong className="font-mono">p90</strong> = the slow tail. If p90 is much bigger than p75, a meaningful fraction of customers take very long to convert — that's your nurture problem.
          </li>
          <li>
            <strong className="font-mono">avg revenue</strong> per platform — high numbers may indicate the platform attracts larger-deal customers (worth scaling).
          </li>
        </ul>
      </Card>
    </div>
  );
}
