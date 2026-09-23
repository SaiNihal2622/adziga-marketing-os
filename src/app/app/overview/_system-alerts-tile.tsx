// Adziga — SystemAlertsTile (Sprint 19b)
// Server component that reads stored webhook + cost alerts and
// renders a single tile summarizing them. Sorted by severity
// (critical first), max 5 items.

import Link from "next/link";
import { WebhookHealthService } from "@/server/services/webhook-health";
import { AgentCostAlertService } from "@/server/services/agent-cost";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

type AlertLike = {
  id: string;
  severity: "info" | "warning" | "critical";
  category: string;
  message: string;
};

export async function SystemAlertsTile({ orgId }: { orgId: string }) {
  const [webhookAlerts, costAlerts] = await Promise.all([
    WebhookHealthService.loadStoredAlerts(orgId),
    AgentCostAlertService.getStoredAlerts(orgId)
  ]);

  // Add category prefix to messages so it's clear which system raised it.
  const merged: AlertLike[] = [
    ...webhookAlerts.map((a) => ({
      id: a.id,
      severity: a.severity as "info" | "warning" | "critical",
      category: `webhook:${a.category}`,
      message: a.message
    })),
    ...costAlerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      category: `cost:${a.metric}`,
      message: a.message
    }))
  ];

  if (merged.length === 0) return null;

  const sorted = merged.sort((a, b) => {
    const oa = SEVERITY_ORDER[a.severity] ?? 3;
    const ob = SEVERITY_ORDER[b.severity] ?? 3;
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });
  const visible = sorted.slice(0, 5);

  const criticalCount = sorted.filter((a) => a.severity === "critical").length;
  const warningCount = sorted.filter((a) => a.severity === "warning").length;

  return (
    <div
      className={`card-v0 p-4 border-l-4 ${
        criticalCount > 0
          ? "border-rose-500"
          : warningCount > 0
            ? "border-amber-500"
            : "border-sky-500"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`size-6 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums ${
            criticalCount > 0
              ? "bg-rose-100 text-rose-700"
              : warningCount > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-sky-100 text-sky-700"
          }`}
        >
          {sorted.length}
        </div>
        <div className="text-xs uppercase tracking-wide font-semibold text-ink-700">System alerts</div>
        {criticalCount > 0 && (
          <span className="text-[10px] font-mono text-rose-700">{criticalCount} critical</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {visible.map((a) => (
          <li key={a.id} className="text-sm flex items-start gap-2">
            <span
              className={`text-[10px] uppercase tracking-wide font-semibold mt-0.5 px-1.5 rounded ${
                a.severity === "critical"
                  ? "bg-rose-100 text-rose-700"
                  : a.severity === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-sky-100 text-sky-700"
              }`}
            >
              {a.severity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-ink-700 truncate">{a.message}</div>
              <div className="text-[10px] text-ink-400 font-mono">{a.category}</div>
            </div>
          </li>
        ))}
        {sorted.length > visible.length && (
          <li className="text-[11px] text-ink-500 italic">
            +{sorted.length - visible.length} older alerts ·{" "}
            <Link href="/app/admin/webhooks" className="text-brand-600 hover:underline">
              All webhooks
            </Link>{" "}
            ·{" "}
            <Link href="/app/admin/agents" className="text-brand-600 hover:underline">
              Agent costs
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
