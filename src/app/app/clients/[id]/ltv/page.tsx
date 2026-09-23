// Adziga — /app/clients/[id]/ltv
// Sprint 16c — per-client Lifetime Value deep dive. Renders the LTV
// report (p25/p50/p75/p90 LTV across customers), the by-age revenue
// curve, byClient comparison row, and the top 25 customers by total
// revenue.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { LtvService } from "@/server/services/ltv-service";
import { PageHeader } from "../../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../../_components/ui";
import { fmtINR, fmtNum, fmtPct, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const WINDOW_OPTIONS = [90, 180, 365, 730] as const;

export default async function ClientLtvPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { days?: string };
}) {
  const session = await requireSession();
  const days = (WINDOW_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 365;

  let r;
  try {
    r = await LtvService.report(session.orgId, params.id, days);
  } catch {
    notFound();
  }

  const clientRow = r.byClient[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Lifetime Value"
        subtitle={`Last ${days} days · customers acquired on/after ${fmtDate(new Date(r.window.since))} · computed ${fmtDate(new Date(r.computedAt))}`}
        breadcrumbs={[
          { label: "Clients", href: "/app/clients" },
          { label: "Client", href: `/app/clients/${params.id}` },
          { label: "LTV" }
        ]}
        right={
          <div className="flex items-center gap-2">
            {clientRow && clientRow.n > 0 && (
              <Badge variant="brand">{clientRow.n} customers</Badge>
            )}
            {clientRow && clientRow.repeatShare > 0 && (
              <Badge variant="info">
                {(clientRow.repeatShare * 100).toFixed(0)}% repeat
              </Badge>
            )}
            <a
              href={`/app/clients/${params.id}`}
              className="px-3 py-1.5 rounded text-xs font-medium bg-ink-100 hover:bg-ink-200"
            >
              ← Back to client
            </a>
          </div>
        }
      />

      {/* Window selector */}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Window:</span>
        {WINDOW_OPTIONS.map((d) => (
          <a
            key={d}
            href={`?days=${d}`}
            className={`px-3 py-1 rounded-md ${
              d === days ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {d === 730 ? "24m" : `${Math.round(d / 30)}m`}
          </a>
        ))}
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="p50 LTV" value={fmtINR(r.overall.p50)} tone="brand" hint="median customer" />
        <Kpi label="Mean LTV" value={fmtINR(r.overall.mean)} hint={`p90 ${fmtINR(r.overall.p90)}`} />
        <Kpi label="Repeat customers" value={fmtPct(r.overall.repeatShare)} hint="with repeat Revenue event" />
        <Kpi label="Revenue / cust / mo" value={fmtINR(r.overall.avgRevenuePerCustomerPerMonth)} hint="trailing avg" />
        <Kpi label="Customers in window" value={r.overall.n.toString()} hint="acquired within window" />
      </div>

      {/* By-age curve */}
      <Card padding="lg">
        <h3 className="text-[15px] font-semibold text-ink-900 mb-3">Revenue by customer age</h3>
        <p className="text-xs text-ink-500 mb-4">
          Avg total revenue per customer, grouped by months since acquisition. Older cohorts include
          repeat-purchase revenue; recent cohorts only contain initial revenue.
        </p>
        {r.byAge.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-500">No customer-age data yet.</div>
        ) : (
          <div className="space-y-2">
            {r.byAge.map((row) => {
              const max = Math.max(...r.byAge.map((b) => b.avgRevenue), 0);
              const pct = max > 0 ? (row.avgRevenue / max) * 100 : 0;
              return (
                <div key={row.monthsSinceAcquisition} className="grid grid-cols-[80px_1fr_120px_60px] items-center gap-3">
                  <div className="text-xs font-mono text-ink-700">M{row.monthsSinceAcquisition}</div>
                  <div className="bg-ink-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs font-mono text-ink-900 tabular-nums">
                    {fmtINR(row.avgRevenue)}
                  </div>
                  <div className="text-right text-[10px] text-ink-500 font-mono">
                    n={row.n}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top customers */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div>
            <h3 className="text-[15px] font-semibold text-ink-900">Top customers</h3>
            <p className="text-xs text-ink-500 mt-0.5">Top 25 by total revenue (initial + repeat).</p>
          </div>
        </div>
        {r.rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            No customer data in this window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Customer</th>
                  <th className="px-5 py-2.5">Acquired</th>
                  <th className="px-5 py-2.5 text-right">Months</th>
                  <th className="px-5 py-2.5 text-right">Initial</th>
                  <th className="px-5 py-2.5 text-right">Repeat</th>
                  <th className="px-5 py-2.5 text-right">Total LTV</th>
                  <th className="px-5 py-2.5 text-right"># Revenue events</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.customerId} className="border-t border-ink-100 hover:bg-ink-50/40">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink-900 truncate">
                        {row.name ?? "—"}{" "}
                        <span className="text-[10px] text-ink-400 font-mono">({row.customerId.slice(-6)})</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-700">{fmtDate(new Date(row.acquiredAt))}</td>
                    <td className="px-5 py-3 text-xs text-right font-mono tabular-nums text-ink-700">
                      M{row.monthsSinceAcquisition}
                    </td>
                    <td className="px-5 py-3 text-xs text-right font-mono tabular-nums">
                      {fmtINR(row.initialRevenue)}
                    </td>
                    <td className="px-5 py-3 text-xs text-right font-mono tabular-nums">
                      {row.repeatRevenue > 0 ? (
                        <span className="text-emerald-700">+{fmtINR(row.repeatRevenue)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-right font-mono font-semibold tabular-nums text-ink-900">
                      {fmtINR(row.totalRevenue)}
                    </td>
                    <td className="px-5 py-3 text-xs text-right font-mono text-ink-700 tabular-nums">
                      {row.revenueEventCount > 0 ? row.revenueEventCount : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Age curve insight */}
      <SectionHeader title="Reading this report" />
      <Card padding="lg">
        <ul className="text-sm text-ink-700 leading-relaxed space-y-2">
          <li>
            • <span className="font-semibold">p50 LTV</span> is the median customer in this window. Use it to anchor LTV/CAC.
          </li>
          <li>
            • <span className="font-semibold">Repeat share</span> tracks whether the client is winning repeat purchases — the
            signature of a healthy funnel. Below 10% means most revenue is one-shot.
          </li>
          <li>
            • <span className="font-semibold">By-age curve</span> shows how revenue compounds over months of customer life.
            Older cohorts will be bigger bars; recent cohorts only show initial-purchase revenue.
          </li>
          <li>
            • <span className="font-semibold">Top customers</span> are the ones driving most of the value — these are the names
            the team should recognize and protect.
          </li>
        </ul>
      </Card>
    </div>
  );
}
