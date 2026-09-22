// Adziga — /api/activity/recent
// GET latest N audit-log events for the org (one-shot, no streaming).

import { authedRoute } from "@/server/api";
import { prisma } from "@/lib/db";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
  const events = await prisma.auditLog.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { id: "desc" },
    take: limit
  });
  const userIds = Array.from(new Set(events.map((e) => e.userId).filter(Boolean) as string[]));
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    events: events.map((e) => {
      const u = e.userId ? userMap.get(e.userId) : null;
      return {
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        summary: e.action.replace(/[._]/g, " "),
        userName: u?.name ?? u?.email ?? "system",
        ts: e.createdAt.toISOString()
      };
    })
  };
});
