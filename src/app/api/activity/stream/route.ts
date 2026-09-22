// Adziga — /api/activity/stream
// Sprint 8b — SSE stream of audit-log events for the dashboard.
//
// Polls the AuditLog table every 2 seconds and emits any new events since
// the last seen id. Serverless-friendly (works across cold starts since
// state is in the DB, not memory).
//
// Wire format:
//   data: { id, action, entityType, entityId, summary, userName, ts }
//
// Heartbeats:
//   ":heartbeat" every 15s so proxies don't time out.

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_LIFETIME_MS = 5 * 60_000; // 5 minutes — clients reconnect after

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  createdAt: Date;
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const lastSeenId = url.searchParams.get("lastSeenId");

  const stream = new ReadableStream({
    async start(controller) {
      const start = Date.now();
      let cursorId: string | null = lastSeenId && lastSeenId.length > 0 ? lastSeenId : null;
      let lastHeartbeat = Date.now();
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      async function lookupUsers(rows: AuditRow[]) {
        const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean) as string[]));
        if (userIds.length === 0) return new Map<string, { name: string | null; email: string }>();
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true }
        });
        return new Map(users.map((u) => [u.id, u]));
      }

      // Initial snapshot of last 10 events for instant render.
      const recent = await prisma.auditLog.findMany({
        where: { orgId: session.orgId },
        orderBy: { id: "desc" },
        take: 10
      });
      const recentUsers = await lookupUsers(recent);
      recent.reverse();
      for (const ev of recent) {
        cursorId = ev.id;
        safeEnqueue(formatEvent(ev, recentUsers.get(ev.userId ?? "") ?? null));
      }

      // Poll loop.
      while (!closed && Date.now() - start < MAX_LIFETIME_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const newOnes = await prisma.auditLog.findMany({
            where: { orgId: session.orgId, ...(cursorId ? { id: { gt: cursorId } } : {}) },
            orderBy: { id: "asc" },
            take: 50
          });
          if (newOnes.length > 0) {
            const newUsers = await lookupUsers(newOnes);
            for (const ev of newOnes) {
              cursorId = ev.id;
              safeEnqueue(formatEvent(ev, newUsers.get(ev.userId ?? "") ?? null));
            }
          }
        } catch {
          // db hiccup — just skip this tick
        }
        if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
          safeEnqueue(":heartbeat\n\n");
          lastHeartbeat = Date.now();
        }
      }

      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function formatEvent(
  ev: AuditRow,
  user: { name: string | null; email: string } | null
): string {
  const summary = humanize(ev.action, ev.entityType, ev.entityId);
  const userName = user?.name ?? user?.email ?? "system";
  const payload = {
    id: ev.id,
    action: ev.action,
    entityType: ev.entityType,
    entityId: ev.entityId,
    summary,
    userName,
    ts: ev.createdAt.toISOString()
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function humanize(action: string, entityType: string | null, entityId: string | null): string {
  const map: Record<string, string> = {
    "lead.create": "New lead",
    "lead.status_change": "Lead status changed",
    "campaign.create": "Campaign created",
    "campaign.update": "Campaign updated",
    "campaign.status_change": "Campaign status changed",
    "experiment.create": "Experiment created",
    "experiment.status_change": "Experiment status changed",
    "experiment.start": "Experiment started",
    "experiment.complete": "Experiment completed",
    "experiment.evaluate": "Experiment evaluated",
    "approval.request": "Approval requested",
    "approval.decision": "Approval decided",
    "client.create": "Client onboarded",
    "client.update": "Client updated",
    "policy.create": "Policy added",
    "policy.delete": "Policy removed"
  };
  const base = map[action] ?? action.replace(/[._]/g, " ");
  if (entityType && entityId) {
    return `${base} · ${entityType.toLowerCase()} ${entityId.slice(0, 8)}`;
  }
  return base;
}
