// Adziga — /app/admin/webhooks
// Sprint 11d — webhook delivery audit page. Lists every incoming webhook
// (Meta leadgen, Razorpay, Meta insights, manual ingestion) with status
// + payload preview + retry capability.

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function markProcessed(formData: FormData) {
  "use server";
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const id = String(formData.get("id"));
  await prisma.webhookDelivery.update({
    where: { id },
    data: { status: "failed", error: "manually marked failed by admin", processedAt: new Date() }
  });
  await prisma.auditLog.create({
    data: {
      orgId: session.orgId,
      userId: session.userId,
      action: "webhook.mark_failed",
      entityType: "WebhookDelivery",
      entityId: id
    }
  });
  revalidatePath("/app/admin/webhooks");
}

async function retryDelivery(formData: FormData) {
  "use server";
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const id = String(formData.get("id"));
  // Hit the API route via internal fetch — keeps retry logic in one place.
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const cookie = await import("next/headers").then((m) => m.cookies()).then((c) => c.toString());
  await fetch(`${baseUrl}/api/admin/webhooks/${id}/retry`, {
    method: "POST",
    headers: { Cookie: cookie },
    cache: "no-store"
  }).catch(() => null);
  await prisma.auditLog.create({
    data: {
      orgId: session.orgId,
      userId: session.userId,
      action: "webhook.retry",
      entityType: "WebhookDelivery",
      entityId: id
    }
  });
  revalidatePath("/app/admin/webhooks");
}

export default async function WebhooksPage({
  searchParams
}: {
  searchParams: { provider?: string; status?: string };
}) {
  await requireRole([Role.FOUNDER, Role.ADMIN]);
  const providerFilter = searchParams.provider ?? "";
  const statusFilter = searchParams.status ?? "";

  const where: any = {};
  if (providerFilter) where.provider = providerFilter;
  if (statusFilter) where.status = statusFilter;

  const [deliveries, distinctProviders, distinctStatuses, counts] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 100
    }),
    prisma.webhookDelivery.findMany({
      select: { provider: true },
      distinct: ["provider"],
      take: 20
    }),
    prisma.webhookDelivery.findMany({
      select: { status: true },
      distinct: ["status"],
      take: 20
    }),
    prisma.webhookDelivery.groupBy({
      by: ["provider", "status"],
      _count: { _all: true }
    })
  ]);

  // Top-line counters
  const totals = deliveries.reduce(
    (acc, d) => {
      acc.total++;
      if (d.status === "received" || d.status === "processing") acc.pending++;
      if (d.status === "failed") acc.failed++;
      if (d.status === "processed") acc.processed++;
      return acc;
    },
    { total: 0, pending: 0, failed: 0, processed: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook deliveries"
        subtitle="Every incoming webhook (Meta leadgen, Razorpay, Meta insights, manual ingestion) is recorded here. Use the status filter to surface what's stuck or failed."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Webhooks" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-1">Provider:</span>
            <Link
              href={`?${statusFilter ? `status=${statusFilter}` : ""}`}
              className={`px-2 py-1 rounded ${!providerFilter ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
            >
              All
            </Link>
            {distinctProviders.map((p) => (
              <Link
                key={p.provider}
                href={`?provider=${p.provider}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`px-2 py-1 rounded ${providerFilter === p.provider ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {p.provider}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Total (100 recent)" value={totals.total} />
        <Kpi label="Pending" value={totals.pending} tone={totals.pending > 5 ? "accent" : "neutral"} />
        <Kpi label="Processed" value={totals.processed} tone="success" />
        <Kpi label="Failed" value={totals.failed} tone={totals.failed > 0 ? "accent" : "neutral"} />
        <Kpi label="Dead-letter" value={deliveries.filter((d) => d.status === "dead_letter").length} tone="accent" hint="exceeded 5 retries" />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-ink-500 mr-1">Status:</span>
        <Link
          href={`?${providerFilter ? `provider=${providerFilter}` : ""}`}
          className={`px-3 py-1 rounded ${!statusFilter ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
        >
          All
        </Link>
        {distinctStatuses.map((s) => (
          <Link
            key={s.status}
            href={`?status=${s.status}${providerFilter ? `&provider=${providerFilter}` : ""}`}
            className={`px-3 py-1 rounded ${statusFilter === s.status ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
          >
            {s.status}
          </Link>
        ))}
      </div>

      <SectionHeader title="Recent deliveries" description="Last 100 webhooks. Click an ID to inspect the payload." />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Provider</th>
                <th className="text-left px-4 py-2">Endpoint</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right">Attempts</th>
                <th className="text-left px-4 py-2">Payload</th>
                <th className="text-left px-4 py-2">Error</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => {
                const payloadPreview = d.payload.length > 80 ? d.payload.slice(0, 80) + "…" : d.payload;
                return (
                  <tr key={d.id} className="border-b border-ink-100">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      <div>{fmtRelative(d.receivedAt)}</div>
                      <div className="text-ink-500 font-mono">{fmtDateTime(d.receivedAt).slice(11, 19)}</div>
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">{d.provider}</td>
                    <td className="px-4 py-2 text-xs font-mono text-ink-700">{d.endpoint}</td>
                    <td className="px-4 py-2 text-xs">
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-right font-mono">{d.attempts}</td>
                    <td className="px-4 py-2 text-xs font-mono text-ink-500 max-w-xs truncate" title={d.payload}>
                      {payloadPreview}
                    </td>
                    <td className="px-4 py-2 text-xs text-rose-700 max-w-md truncate" title={d.error ?? ""}>
                      {d.error ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-right">
                      {(d.status === "received" || d.status === "processing" || d.status === "failed") && (
                        <div className="flex items-center gap-2 justify-end">
                          {d.status === "failed" && (
                            <form action={retryDelivery}>
                              <input type="hidden" name="id" value={d.id} />
                              <button className="text-brand-600 hover:text-brand-800 font-medium">
                                ↻ Retry
                              </button>
                            </form>
                          )}
                          {(d.status === "received" || d.status === "processing") && (
                            <form action={markProcessed}>
                              <input type="hidden" name="id" value={d.id} />
                              <button className="text-rose-600 hover:text-rose-800 font-medium">
                                Mark failed
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-500">
                    No webhooks yet. Connect a platform integration (Meta, Razorpay) and they'll appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function statusVariant(s: string): "neutral" | "brand" | "success" | "warning" | "accent" {
  if (s === "processed") return "success";
  if (s === "failed") return "warning";
  if (s === "received" || s === "processing") return "accent";
  return "neutral";
}
