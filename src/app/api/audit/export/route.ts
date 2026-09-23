// Adziga — /api/audit/export
// Sprint 15d — audit log CSV export.

import { authedRoute } from "@/server/api";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 86_400_000);

  const logs = await prisma.auditLog.findMany({
    where: { orgId: ctx.orgId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5000
  });
  const userIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean) as string[]));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = logs.map((l) => {
    const u = l.userId ? userMap.get(l.userId) : null;
    return {
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      action: l.action,
      entityType: l.entityType ?? "",
      entityId: l.entityId ?? "",
      userName: u?.name ?? "",
      userEmail: u?.email ?? "",
      before: l.before ?? "",
      after: l.after ?? "",
      ip: l.ip ?? "",
      userAgent: l.userAgent ?? ""
    };
  });
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${days}d.csv"`
    }
  });
});
