// Adziga — Webhook Health Banner (Sprint 17a)
// Server-rendered banner that surfaces the top webhook-health alerts
// stored in Organization.metadata.alerts. Shows critical/warning
// alerts and a one-click "View DLQ" call to action.

import Link from "next/link";
import type { WebhookHealthAlert } from "@/server/services/webhook-health";

const SEVERITY_MAP: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  critical: {
    label: "Critical",
    bg: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-200"
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200"
  },
  info: {
    label: "Info",
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200"
  }
};

export function HealthBanner({ alerts }: { alerts: WebhookHealthAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  // Sort: critical → warning → info; most recent first.
  const order = { critical: 0, warning: 1, info: 2 } as const;
  const sorted = [...alerts].sort((a, b) => {
    const oa = order[a.severity as keyof typeof order] ?? 3;
    const ob = order[b.severity as keyof typeof order] ?? 3;
    if (oa !== ob) return oa - ob;
    return b.raisedAt.localeCompare(a.raisedAt);
  });

  const top = sorted[0];
  const sev = SEVERITY_MAP[top.severity] ?? SEVERITY_MAP.info;

  return (
    <div className={`rounded-lg ring-1 ${sev.ring} ${sev.bg} p-3 mb-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] uppercase tracking-wide font-semibold ${sev.text}`}>
              {sev.label}
            </span>
            <span className="text-xs font-mono text-ink-500">{top.category}</span>
            {sorted.length > 1 && (
              <span className="text-[10px] text-ink-500 font-mono">
                +{sorted.length - 1} more
              </span>
            )}
          </div>
          <p className="text-sm text-ink-900 mt-1">{top.message}</p>
          <ul className="mt-2 space-y-1">
            {sorted.slice(1, 3).map((a) => {
              const s = SEVERITY_MAP[a.severity] ?? SEVERITY_MAP.info;
              return (
                <li key={a.id} className="text-xs flex items-center gap-2">
                  <span className={`${s.text} font-semibold`}>{s.label}</span>
                  <span className="text-ink-600 truncate">{a.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <Link
            href="/app/admin/webhooks/dlq"
            className="text-xs font-medium text-brand-700 hover:text-brand-900"
          >
            Open DLQ →
          </Link>
          <Link
            href={`/app/admin/webhooks?provider=${top.provider ?? ""}`}
            className="text-xs text-ink-600 hover:text-ink-900"
          >
            {top.provider ? `Filter ${top.provider}` : "All webhooks"}
          </Link>
        </div>
      </div>
    </div>
  );
}
