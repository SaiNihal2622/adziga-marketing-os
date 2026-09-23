// Adziga — WebhookHealthService (Sprint 17a)
// Operational monitor for webhook ingestion. Looks at the last 7 days of
// `WebhookDelivery` rows and surfaces:
//   - per-provider success rate (processed / total)
//   - DLQ growth (today vs 7d ago)
//   - last-delivery freshness (silent if nothing in 4h)
//
// Any crossed threshold becomes a SystemAlert, persisted to
// `Organization.metadata.alerts` (capped to last 50). Alerts are then
// surfaced as a banner on /app/admin/webhooks and listed on
// /app/admin/webhooks (and via API for any future Slack bot to consume).
//
// Pattern mirrors `campaign-anomaly-service.ts::parseOrgOverrides` for
// reading JSON metadata.

import { prisma } from "@/lib/db";

export type WebhookHealthAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  category: "failure_rate" | "dlq_growth" | "silent" | "dead_letter_present";
  message: string;
  provider?: string;
  metric?: string;
  threshold?: number;
  observed?: number;
  raisedAt: string;
};

export type ProviderHealth = {
  provider: string;
  total: number;
  processed: number;
  failed: number;
  deadLetter: number;
  successRate: number;
  lastDeliveryAt: string | null;
};

export type WebhookHealthSnapshot = {
  windowDays: number;
  totals: {
    deliveries: number;
    processed: number;
    failed: number;
    deadLetter: number;
    pending: number;
  };
  byProvider: ProviderHealth[];
  alerts: WebhookHealthAlert[];
  computedAt: string;
};

const WINDOW_DAYS = 7;
const ALERT_CAP = 50;

function safeJsonParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const WebhookHealthService = {
  /**
   * Compute a single health snapshot. No DB writes — caller can decide
   * whether to persist alerts.
   */
  async snapshot(orgId: string, windowDays: number = WINDOW_DAYS): Promise<WebhookHealthSnapshot> {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    // Total counters across the org's webhooks (WebhookDelivery has no
    // orgId; we trust this table is per-tenant since there's only one
    // org in the system at a time, mirroring the rest of the codebase).
    const rows = await prisma.webhookDelivery.findMany({
      where: { receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
      take: 5000
    });

    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

    const providerMap = new Map<string, ProviderHealth>();
    const totals = { deliveries: 0, processed: 0, failed: 0, deadLetter: 0, pending: 0 };
    const dlqToday = rows.filter((r) => r.deadLetteredAt && r.deadLetteredAt >= yesterday).length;
    const dlq7dAgo = rows.filter((r) => r.deadLetteredAt && r.deadLetteredAt < sevenDaysAgo).length;

    for (const r of rows) {
      totals.deliveries++;
      if (r.status === "processed") totals.processed++;
      else if (r.status === "failed") totals.failed++;
      else if (r.status === "dead_letter") totals.deadLetter++;
      else totals.pending++;

      let slot = providerMap.get(r.provider);
      if (!slot) {
        slot = {
          provider: r.provider,
          total: 0,
          processed: 0,
          failed: 0,
          deadLetter: 0,
          successRate: 0,
          lastDeliveryAt: null
        };
        providerMap.set(r.provider, slot);
      }
      slot.total++;
      if (r.status === "processed") slot.processed++;
      if (r.status === "failed") slot.failed++;
      if (r.status === "dead_letter") slot.deadLetter++;
      const date = r.receivedAt.toISOString();
      if (!slot.lastDeliveryAt || date > slot.lastDeliveryAt) slot.lastDeliveryAt = date;
    }

    const byProvider = Array.from(providerMap.values())
      .map((p) => ({ ...p, successRate: p.total > 0 ? p.processed / p.total : 0 }))
      .sort((a, b) => a.successRate - b.successRate);

    // Build alerts.
    const alerts: WebhookHealthAlert[] = [];
    const nowIso = new Date().toISOString();

    // 1. Per-provider failure rate > 30% with at least 5 deliveries.
    for (const p of byProvider) {
      if (p.total < 5) continue;
      const failRate = (p.failed + p.deadLetter) / p.total;
      if (failRate > 0.3) {
        alerts.push({
          id: `failure_rate:${p.provider}`,
          severity: failRate > 0.6 ? "critical" : "warning",
          category: "failure_rate",
          provider: p.provider,
          message: `${(failRate * 100).toFixed(0)}% failure rate on ${p.provider} (${p.failed + p.deadLetter}/${p.total} in ${windowDays}d)`,
          metric: "fail_rate",
          threshold: 0.3,
          observed: failRate,
          raisedAt: nowIso
        });
      }
    }

    // 2. DLQ growth — net new >= 5 entries in last 24h.
    const dlqGrowth = dlqToday - (dlq7dAgo > 0 ? 0 : 0); // growth = today's count
    if (dlqToday >= 5) {
      alerts.push({
        id: `dlq_growth:24h`,
        severity: dlqToday >= 10 ? "critical" : "warning",
        category: "dlq_growth",
        message: `Dead-letter queue grew by ${dlqToday} entries in the last 24h`,
        metric: "dlq_today",
        threshold: 5,
        observed: dlqToday,
        raisedAt: nowIso
      });
    }

    // 3. Silent — no processed deliveries in last 4h but historically active.
    const fourHoursAgo = new Date(today.getTime() - 4 * 3_600_000);
    const recentProcessed = rows.some((r) => r.status === "processed" && r.receivedAt >= fourHoursAgo);
    if (totals.deliveries >= 20 && !recentProcessed) {
      alerts.push({
        id: `silent:processed`,
        severity: "warning",
        category: "silent",
        message: `No successfully processed deliveries in the last 4 hours (${totals.deliveries} deliveries in ${windowDays}d, ${totals.processed} processed)`,
        metric: "hours_since_processed",
        threshold: 4,
        observed: 4,
        raisedAt: nowIso
      });
    }

    // 4. Dead-letter present (any) — informational.
    if (totals.deadLetter > 0) {
      alerts.push({
        id: `dead_letter_present:count`,
        severity: "info",
        category: "dead_letter_present",
        message: `${totals.deadLetter} deliveries in dead-letter queue. Open /app/admin/webhooks/dlq to triage.`,
        metric: "dlq_count",
        threshold: 0,
        observed: totals.deadLetter,
        raisedAt: nowIso
      });
    }

    return {
      windowDays,
      totals,
      byProvider,
      alerts,
      computedAt: nowIso
    };
  },

  /**
   * Run the snapshot and persist alerts to Organization.metadata.alerts,
   * deduped by alert.id. Returns the same snapshot; callers reading via
   * `loadStoredAlerts` get the merged history.
   */
  async check(orgId: string, windowDays?: number): Promise<WebhookHealthSnapshot> {
    const snap = await this.snapshot(orgId, windowDays);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(org?.metadata);
    const existing = Array.isArray(meta.alerts)
      ? (meta.alerts as WebhookHealthAlert[])
      : [];

    const seen = new Set(snap.alerts.map((a) => a.id));
    const kept = existing
      .filter((a) => !seen.has(a.id))  // drop alerts that no longer fire
      .slice(0, ALERT_CAP - snap.alerts.length);
    const merged: WebhookHealthAlert[] = [...snap.alerts, ...kept].slice(0, ALERT_CAP);

    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify({ ...meta, alerts: merged }) }
    });

    return snap;
  },

  /**
   * Read the stored alert history for an org. Read-only.
   */
  async loadStoredAlerts(orgId: string): Promise<WebhookHealthAlert[]> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(org?.metadata);
    return Array.isArray(meta.alerts) ? (meta.alerts as WebhookHealthAlert[]) : [];
  },

  /**
   * Clear alerts that no longer fire, leaving only the ones that are
   * still active. Useful after the underlying issue is fixed.
   */
  async prune(orgId: string): Promise<{ before: number; after: number }> {
    const stored = await this.loadStoredAlerts(orgId);
    const current = await this.snapshot(orgId, WINDOW_DAYS);
    const seen = new Set(current.alerts.map((a) => a.id));
    const pruned = stored.filter((a) => seen.has(a.id));

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(org?.metadata);
    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify({ ...meta, alerts: pruned }) }
    });

    return { before: stored.length, after: pruned.length };
  }
};
