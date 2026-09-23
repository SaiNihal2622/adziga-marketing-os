"use client";

// Adziga — HealthCheckButton (Sprint 17a)
// Inline client button. POSTs to /api/admin/webhooks/health, then
// refreshes the page so the new banner reflects.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WebhookHealthAlert } from "@/server/services/webhook-health";

export function HealthCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch("/api/admin/webhooks/health", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      const alerts: WebhookHealthAlert[] = j.alerts ?? [];
      const counts = alerts.reduce(
        (acc, a) => {
          acc[a.severity] = (acc[a.severity] ?? 0) + 1;
          return acc;
        },
        { critical: 0, warning: 0, info: 0 } as Record<string, number>
      );
      setSummary(
        `✓ ${j.totals.deliveries} deliveries · ${counts.critical} critical · ${counts.warning} warning · ${counts.info} info`
      );
      router.refresh();
    } catch (e) {
      setSummary(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {summary && <span className="text-ink-500">{summary}</span>}
      <button
        onClick={onClick}
        disabled={busy}
        className="px-2 py-1 rounded bg-ink-100 text-ink-700 hover:bg-ink-200 disabled:opacity-50"
      >
        {busy ? "Checking…" : "✓ Run health check"}
      </button>
    </div>
  );
}
