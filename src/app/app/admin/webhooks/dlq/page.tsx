// Adziga — /app/admin/webhooks/dlq
// Sprint 16d — focused dead-letter queue. Lists only deliveries that
// have hit the DLQ (status="dead_letter"), with retry + resolve actions
// per row and bulk "purge resolved" at the bottom.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../../_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader } from "../../../_components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { retryDelivery, resolveDelivery, purgeResolved } from "./dlq-actions";

export const dynamic = "force-dynamic";

export default async function DlqPage({
  searchParams
}: {
  searchParams: { provider?: string };
}) {
  await requireRole([Role.FOUNDER, Role.ADMIN]);
  const providerFilter = searchParams.provider ?? "";

  const where: any = { status: "dead_letter" };
  if (providerFilter) where.provider = providerFilter;

  const [dlq, distinctProviders, totals, oldest] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { deadLetteredAt: "desc" },
      take: 200
    }),
    prisma.webhookDelivery.findMany({
      where: { status: "dead_letter" },
      select: { provider: true },
      distinct: ["provider"],
      take: 20
    }),
    prisma.webhookDelivery.groupBy({
      by: ["provider"],
      where: { status: "dead_letter" },
      _count: { _all: true },
      _max: { deadLetteredAt: true }
    }),
    prisma.webhookDelivery.findFirst({
      where: { status: "dead_letter" },
      orderBy: { deadLetteredAt: "asc" },
      select: { deadLetteredAt: true }
    })
  ]);

  // Top failing provider — by count
  const topProvider = totals.sort((a, b) => b._count._all - a._count._all)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dead-letter queue"
        subtitle="Webhook deliveries that exhausted their retry budget. Each row has a Retry button (re-runs through the retry API) and a Resolve button (marks processed + audit-logs the resolution)."
        breadcrumbs={[
          { label: "Admin", href: "/app/admin" },
          { label: "Webhooks", href: "/app/admin/webhooks" },
          { label: "DLQ" }
        ]}
        right={
          <Link href="/app/admin/webhooks">
            <Button variant="outline">← All deliveries</Button>
          </Link>
        }
      />

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="DLQ depth" value={dlq.length} tone={dlq.length > 0 ? "accent" : "neutral"} hint="dead-lettered" />
        <Kpi
          label="Top failing provider"
          value={topProvider?.provider ?? "—"}
          hint={topProvider ? `${topProvider._count._all} stuck` : "no failures"}
        />
        <Kpi
          label="Oldest stuck"
          value={oldest?.deadLetteredAt ? fmtRelative(oldest.deadLetteredAt) : "—"}
          hint={oldest?.deadLetteredAt ? fmtDateTime(oldest.deadLetteredAt) : undefined}
        />
        <Kpi label="Distinct providers" value={distinctProviders.length.toString()} hint="with failures" />
      </div>

      {/* Provider filter */}
      {distinctProviders.length > 0 && (
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mr-2">Provider</span>
            <Link
              href="/app/admin/webhooks/dlq"
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${!providerFilter ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
            >
              All
            </Link>
            {distinctProviders.map((p) => (
              <Link
                key={p.provider}
                href={`?provider=${p.provider}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${providerFilter === p.provider ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
              >
                {p.provider}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <SectionHeader title={`Stuck deliveries${providerFilter ? ` · ${providerFilter}` : ""}`} description="Last 200 in DLQ." />

      {dlq.length === 0 ? (
        <Card>
          <div className="px-5 py-12 text-center">
            <div className="text-emerald-600 font-semibold mb-1">Queue empty</div>
            <p className="text-sm text-ink-500">No dead-lettered webhooks. If you expected to see something here, check that retries actually exhausted.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-4 py-3">Dead-lettered</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3 text-right">Attempts</th>
                  <th className="px-4 py-3">Last error</th>
                  <th className="px-4 py-3">Payload</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dlq.map((d) => {
                  const payloadPreview = d.payload.length > 80 ? d.payload.slice(0, 80) + "…" : d.payload;
                  return (
                    <tr key={d.id} className="border-t border-ink-100 hover:bg-ink-50/40">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div>{fmtRelative(d.deadLetteredAt ?? d.lastAttemptAt ?? d.receivedAt)}</div>
                        <div className="text-ink-500 font-mono">
                          {fmtDateTime(d.deadLetteredAt ?? d.lastAttemptAt ?? d.receivedAt).slice(0, 16)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{d.provider}</td>
                      <td className="px-4 py-3 text-xs font-mono text-ink-700">{d.endpoint}</td>
                      <td className="px-4 py-3 text-xs text-right font-mono">{d.attempts}</td>
                      <td className="px-4 py-3 text-xs text-rose-700 max-w-md truncate" title={d.error ?? ""}>
                        {d.error ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-ink-500 max-w-xs truncate" title={d.payload}>
                        {payloadPreview}
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <form action={retryDelivery}>
                            <input type="hidden" name="id" value={d.id} />
                            <button
                              type="submit"
                              className="text-brand-600 hover:text-brand-800 font-medium"
                            >
                              ↻ Retry
                            </button>
                          </form>
                          <form action={resolveDelivery}>
                            <input type="hidden" name="id" value={d.id} />
                            <button
                              type="submit"
                              className="text-emerald-600 hover:text-emerald-800 font-medium"
                            >
                              ✓ Resolve
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Footer — bulk purge button */}
      {dlq.length > 0 && (
        <Card padding="lg" className="bg-rose-50/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink-900">Bulk cleanup</h3>
              <p className="text-xs text-ink-600 mt-1">
                Purge (permanently delete) deliveries that have already been manually resolved. Use after
                you've worked through the queue.
              </p>
            </div>
            <form action={purgeResolved}>
              <Button type="submit" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
                Purge resolved
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
