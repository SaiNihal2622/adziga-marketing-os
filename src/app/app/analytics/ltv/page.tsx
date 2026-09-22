// Adziga — /app/analytics/ltv
// Sprint 12b — true LTV dashboard using Revenue event log.

import { LtvService } from "@/server/services/ltv-service";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [90, 180, 365, 730] as const;

export default async function LtvPage({
  searchParams
}: {
  searchParams: { days?: string; clientId?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 365;
  const clientId = searchParams.clientId;

  const report = await LtvService.report(session.orgId, clientId, days);
  const clients = await prisma.client.findMany({
    where: { orgId: session.orgId },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer LTV"
        subtitle="True lifetime value from the Revenue event log. Repeat purchases, upsells, and subscriptions all count. Default window: 12 months back."
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Analytics", href: "/app/analytics" }, { label: "LTV" }]}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Customers" value={fmtNum(report.overall.n)} hint={`last ${days} days`} />
        <Kpi label="Mean LTV" value={fmtINR(report.overall.mean)} hint="total revenue / customer" tone={report.overall.mean > 0 ? "success" : "neutral"} />
        <Kpi label="p50 LTV" value={fmtINR(report.overall.p50)} />
        <Kpi label="Repeat share" value={fmtPct(report.overall.repeatShare, 1)} hint="% of customers with >1 Revenue event" tone={report.overall.repeatShare > 0.1 ? "success" : report.overall.repeatShare > 0 ? "neutral" : "accent"} />
      </div>

      <SectionHeader title="By client" description="Mean LTV and repeat share, sorted by mean LTV" />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-right">n</th>
                <th className="text-right">Mean LTV</th>
                <th className="text-right">p50 LTV</th>
                <th className="text-right">Repeat share</th>
              </tr>
            </thead>
            <tbody>
              {report.byClient.map((c) => (
                <tr key={c.clientId} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-medium">{c.clientName}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.n}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(c.mean)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(c.p50)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(c.repeatShare, 1)}</td>
                </tr>
              ))}
              {report.byClient.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-ink-500 py-6">
                    No customers in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionHeader title="LTV by tenure" description="Average revenue per customer by months since acquisition. Steeper curves = healthier repeat behaviour." />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Months since acquisition</th>
                <th className="text-right">n</th>
                <th className="text-right">Avg revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.byAge.map((b) => (
                <tr key={b.monthsSinceAcquisition} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-mono">{b.monthsSinceAcquisition}mo</td>
                  <td className="px-4 py-2 text-right font-mono">{b.n}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(b.avgRevenue)}</td>
                </tr>
              ))}
              {report.byAge.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-ink-500 py-6">No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionHeader title="Top customers" description="Highest total LTV (initial + repeat revenue)" />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-left px-4 py-2">Acquired</th>
                <th className="text-left px-4 py-2">Tenure</th>
                <th className="text-right">Initial</th>
                <th className="text-right">Repeat</th>
                <th className="text-right">Total LTV</th>
                <th className="text-right">Events</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.customerId} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-medium">{r.name ?? "—"}</td>
                  <td className="px-4 py-2">{r.clientName}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">{r.acquiredAt.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-xs font-mono">{r.monthsSinceAcquisition}mo</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(r.initialRevenue)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtINR(r.repeatRevenue)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{fmtINR(r.totalRevenue)}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.revenueEventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
