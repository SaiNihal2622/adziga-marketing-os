// Adziga — /app/admin/investments
// Channel investment strategy. The value-based allocator surfaces where
// each rupee should go, why, and how it compares to current spend.
// From the Marketing OS vision: the system reasons about portfolio
// composition, not individual campaign tweaks.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { AttributionService } from "@/server/services/attribution-service";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage({
  searchParams
}: {
  searchParams: { clientId?: string; budget?: string };
}) {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const clientId = searchParams.clientId;
  const totalBudget = Number(searchParams.budget ?? "0");

  const [allocation, clients] = await Promise.all([
    AttributionService.valueBasedAllocate(session.orgId, { clientId, totalBudget }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  // Current actual spend per platform for comparison
  const since = new Date(Date.now() - 60 * 86_400_000);
  const camps = await prisma.campaign.findMany({
    where: {
      orgId: session.orgId,
      ...(clientId ? { clientId } : {}),
      createdAt: { gte: since }
    },
    select: { platform: true, spent: true }
  });
  const actualSpendByPlatform = new Map<string, number>();
  for (const c of camps) {
    actualSpendByPlatform.set(c.platform, (actualSpendByPlatform.get(c.platform) ?? 0) + c.spent);
  }
  const totalActual = Array.from(actualSpendByPlatform.values()).reduce((s, v) => s + v, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Marketing OS"
        title="Channel investments"
        subtitle="Where each rupee should go, based on observed value-per-rupee. Capped at 50% per channel, with 10% reserved for exploration."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Investments" }]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Avg deal size"
          value={fmtINR(allocation.avgDealSize)}
          hint="anchor for value calc"
          tone="brand"
        />
        <Kpi
          label="Expected ROAS"
          value={`${allocation.expectedRoas.toFixed(2)}×`}
          tone={allocation.expectedRoas >= 2 ? "success" : "neutral"}
          hint="at recommended split"
        />
        <Kpi
          label="Top channel"
          value={allocation.allocations[0]?.platform ?? "—"}
          hint={`${(allocation.allocations[0]?.allocation ?? 0 * 100).toFixed(0)}% allocation`}
        />
        <Kpi
          label="Channels"
          value={String(allocation.allocations.length)}
          hint={`${allocation.allocations.filter((a) => a.valuePerRupee > 0).length} with data`}
        />
      </div>

      {/* Allocator summary */}
      <Card padding="lg" className="mb-6 bg-gradient-to-br from-white via-white to-brand-50/40 border-brand-200/60">
        <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">Reasoning</div>
        <p className="text-sm text-ink-700 leading-relaxed">{allocation.reasoning}</p>
        <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap items-center gap-2">
          <Link href={`/app/admin/investments?${new URLSearchParams({ ...(clientId ? { clientId } : {}) }).toString()}&budget=1000000`}>
            <Button size="sm" variant="outline">Project at ₹10L</Button>
          </Link>
          <Link href={`/app/admin/investments?${new URLSearchParams({ ...(clientId ? { clientId } : {}), budget: "5000000" }).toString()}`}>
            <Button size="sm" variant="outline">Project at ₹50L</Button>
          </Link>
          <Link href={`/app/admin/investments?${new URLSearchParams({ ...(clientId ? { clientId } : {}), budget: "10000000" }).toString()}`}>
            <Button size="sm" variant="outline">Project at ₹1Cr</Button>
          </Link>
        </div>
      </Card>

      {/* Client scope */}
      {clients.length > 0 && (
        <Card padding="sm" className="mb-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mr-2">Scope</span>
            <Link href="/app/admin/investments" className={`px-2.5 py-1 rounded-full text-xs font-medium ${!clientId ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}>
              All clients
            </Link>
            {clients.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/app/admin/investments?clientId=${c.id}${searchParams.budget ? `&budget=${searchParams.budget}` : ""}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${clientId === c.id ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
              >
                {c.businessName}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Allocation table */}
      <SectionHeader title="Recommended allocation" description="Sorted by allocation. Each row explains why this channel earned its share." />
      {allocation.allocations.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h3 className="font-semibold text-ink-900">No allocation data yet</h3>
            <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
              Once campaigns start running and leads start converting, the allocator will surface recommended splits here.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Allocation</th>
                <th className="px-5 py-3 text-right">Budget (₹)</th>
                <th className="px-5 py-3 text-right">Current spend</th>
                <th className="px-5 py-3 text-right">Leads</th>
                <th className="px-5 py-3 text-right">Customers</th>
                <th className="px-5 py-3 text-right">ROAS</th>
                <th className="px-5 py-3 text-right">Value / ₹</th>
                <th className="px-5 py-3">Why</th>
              </tr>
            </thead>
            <tbody>
              {allocation.allocations.map((r) => {
                const actualSpend = actualSpendByPlatform.get(r.platform) ?? 0;
                const actualPct = totalActual > 0 ? actualSpend / totalActual : 0;
                const delta = r.allocation - actualPct;
                return (
                  <tr key={r.platform} className="border-t border-ink-100">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink-900">{r.platform}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{r.campaigns} campaign{r.campaigns === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-ink-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${r.allocation * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium tabular-nums">{(r.allocation * 100).toFixed(1)}%</span>
                      </div>
                      {totalActual > 0 && (
                        <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums">
                          Currently: {(actualPct * 100).toFixed(1)}%
                          {Math.abs(delta) > 0.01 && (
                            <span className={delta > 0 ? "text-emerald-600 ml-1" : "text-rose-600 ml-1"}>
                              ({delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}pp)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {totalBudget > 0 ? fmtINR(r.budgetInr) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-500">{fmtINR(actualSpend)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.leads)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.customers)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={r.roas >= 2 ? "text-emerald-700 font-medium" : r.roas >= 1 ? "text-ink-900" : "text-rose-700"}>
                        {r.revenue > 0 ? `${r.roas.toFixed(2)}×` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={r.valuePerRupee >= 2 ? "text-emerald-700 font-medium" : r.valuePerRupee >= 1 ? "text-ink-900" : r.valuePerRupee > 0 ? "text-rose-700" : "text-ink-400"}>
                        {r.valuePerRupee > 0 ? `${r.valuePerRupee.toFixed(2)}×` : "—"}
                      </span>
                      <div className="text-[10px] text-ink-400 mt-0.5">cred {(r.credibility * 100).toFixed(0)}%</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-600 leading-snug max-w-xs">{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <SectionHeader title="Apply this allocation" description="Push the recommendations to live campaigns." />
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <Badge variant="info" dot>Adziga-controlled</Badge>
          <div className="flex-1">
            <div className="text-sm text-ink-700 leading-relaxed">
              Reallocating budgets across channels is an <strong>important</strong> change — it goes through the
              <Link href="/app/admin/approvals" className="text-brand-600 hover:underline font-medium mx-1">approvals queue</Link>
              before any campaign is touched. Open a reallocation approval from the Strategy Agent chat, or
              pick a specific campaign below to apply manually.
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Link href={`/app/ai${clientId ? `?clientId=${clientId}` : ""}`}>
                <Button size="sm">Discuss with Strategy Agent</Button>
              </Link>
              <Link href={`/app/campaigns${clientId ? `?clientId=${clientId}` : ""}`}>
                <Button variant="outline" size="sm">View campaigns</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
