"use client";

// Adziga — RecomputeHealthButton (Sprint 16b)
// Server-action-driven button that hits /api/campaigns/health-score-batch,
// shows a counter (healthy/at-risk/critical), and refreshes the page so
// the refreshed Campaign.health tiers come back into the table.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecomputeHealthButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch("/api/campaigns/health-score-batch", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setSummary(
        `✓ ${j.total} campaigns · ${j.healthy} healthy · ${j.atRisk} at risk · ${j.critical} critical`
      );
      router.refresh();
    } catch (e) {
      setSummary(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={onClick}
        disabled={busy}
        className="px-2 py-1 rounded bg-ink-100 text-ink-700 hover:bg-ink-200 disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "↻ Recompute health"}
      </button>
      {summary && <span className="text-ink-500">{summary}</span>}
    </div>
  );
}
