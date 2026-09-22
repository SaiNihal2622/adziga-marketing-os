// Adziga — /app/audit
// Sprint 8c — audit log search/filter UI.
// Server-rendered: filters come from URL query params, results stream
// straight from the AuditLog table.

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../_components/ui";
import { fmtDateTime, relTime } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AuditPage({
  searchParams
}: {
  searchParams: { q?: string; action?: string; entity?: string; days?: string; page?: string };
}) {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const q = (searchParams.q ?? "").trim();
  const actionFilter = (searchParams.action ?? "").trim();
  const entityFilter = (searchParams.entity ?? "").trim();
  const days = Math.min(Math.max(parseInt(searchParams.days ?? "7", 10) || 7, 1), 365);
  const since = new Date(Date.now() - days * 86_400_000);
  const page = Math.max(parseInt(searchParams.page ?? "1", 10) || 1, 1);

  const where: any = { orgId: session.orgId, createdAt: { gte: since } };
  if (actionFilter) where.action = { startsWith: actionFilter };
  if (entityFilter) where.entityType = entityFilter;
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { after: { contains: q, mode: "insensitive" } },
      { before: { contains: q, mode: "insensitive" } }
    ];
  }

  const [logs, totalCount, distinctActions, distinctEntities, userIds] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { orgId: session.orgId, createdAt: { gte: since } },
      select: { action: true },
      distinct: ["action"],
      take: 50
    }),
    prisma.auditLog.findMany({
      where: { orgId: session.orgId, createdAt: { gte: since }, entityType: { not: null } },
      select: { entityType: true },
      distinct: ["entityType"],
      take: 50
    }),
    prisma.auditLog.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
      take: 50
    })
  ]);

  const userIdsList = userIds.map((u) => u.userId).filter(Boolean) as string[];
  const users = userIdsList.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIdsList } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Stats — last 24h vs prior 24h
  const last24h = new Date(Date.now() - 86_400_000);
  const prev24h = new Date(Date.now() - 2 * 86_400_000);
  const [last24hCount, prev24hCount] = await Promise.all([
    prisma.auditLog.count({ where: { orgId: session.orgId, createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { orgId: session.orgId, createdAt: { gte: prev24h, lt: last24h } } })
  ]);
  const delta24h = prev24hCount > 0 ? ((last24hCount - prev24hCount) / prev24hCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Every meaningful action is recorded with author, before/after, IP, and user agent. Searchable across actions, entities, and payloads."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Audit" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            {[1, 7, 30, 90].map((d) => (
              <Link
                key={d}
                href={withParams(searchParams, { days: String(d), page: "1" })}
                className={`px-2 py-1 rounded ${days === d ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total events" value={totalCount.toLocaleString("en-IN")} hint={`last ${days} days`} />
        <Kpi label="Last 24h" value={last24hCount.toLocaleString("en-IN")} hint={prev24hCount > 0 ? `${delta24h > 0 ? "+" : ""}${delta24h.toFixed(0)}% vs prior` : "—"} />
        <Kpi label="Distinct actions" value={distinctActions.length.toString()} hint="action types seen" />
        <Kpi label="Distinct entities" value={distinctEntities.length.toString()} hint="entity types seen" />
      </div>

      {/* Filters */}
      <Card>
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="days" value={days} />
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] text-ink-500 uppercase tracking-wide">Search</label>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="action, entity id, payload…"
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-500 uppercase tracking-wide">Action starts with</label>
            <select name="action" defaultValue={actionFilter} className="input mt-1">
              <option value="">— any —</option>
              {distinctActions.map((a) => (
                <option key={a.action} value={a.action}>{a.action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-500 uppercase tracking-wide">Entity</label>
            <select name="entity" defaultValue={entityFilter} className="input mt-1">
              <option value="">— any —</option>
              {distinctEntities.map((e) => (
                <option key={e.entityType ?? "_"} value={e.entityType ?? ""}>{e.entityType}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Filter</button>
          {(q || actionFilter || entityFilter) && (
            <Link href={`/app/audit?days=${days}`} className="btn btn-ghost">Clear</Link>
          )}
        </form>
      </Card>

      <SectionHeader
        title={`Events${totalCount > 0 ? ` (${totalCount.toLocaleString("en-IN")})` : ""}`}
        description={totalPages > 1 ? `Page ${page} of ${totalPages}` : undefined}
      />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Entity</th>
                <th className="text-left px-4 py-2">By</th>
                <th className="text-left px-4 py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const u = l.userId ? userMap.get(l.userId) : null;
                const payloadStr = l.after ?? l.before;
                return (
                  <tr key={l.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      <div>{relTime(l.createdAt)}</div>
                      <div className="text-ink-500 font-mono">{fmtDateTime(l.createdAt).slice(11, 19)}</div>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <Badge variant={l.action.includes("delete") ? "warning" : "neutral"}>{l.action}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="font-medium">{l.entityType ?? "—"}</div>
                      {l.entityId && <div className="text-ink-500 font-mono">{l.entityId.slice(0, 16)}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {u?.name ?? u?.email ?? <span className="text-ink-500 font-mono">{l.userId?.slice(0, 8) ?? "system"}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-ink-600 max-w-md truncate" title={payloadStr ?? ""}>
                      {payloadStr ?? <span className="text-ink-400">—</span>}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink-500">
                    No events match these filters. Try widening the time window or clearing filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <div className="text-ink-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={withParams(searchParams, { page: String(page - 1) })} className="px-3 py-1 rounded bg-ink-100 hover:bg-ink-200">
                ← Prev
              </Link>
            )}
            <span className="px-3 py-1 text-ink-500">
              Page {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link href={withParams(searchParams, { page: String(page + 1) })} className="px-3 py-1 rounded bg-ink-100 hover:bg-ink-200">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function withParams(current: Record<string, string>, patch: Record<string, string>) {
  const merged = { ...current, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  return `?${sp.toString()}`;
}
