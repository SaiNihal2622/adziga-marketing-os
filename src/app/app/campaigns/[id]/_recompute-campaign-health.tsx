"use client";

// Adziga — RecomputeCampaignHealthButton (Sprint 16b)
// Inline client button used inside the campaign-detail HealthPanel.
// Calls /api/campaigns/[id]/health-score, refreshes the page, and
// shows the refreshed tier + score.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecomputeCampaignHealthButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/health-score`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setMsg(`✓ ${j.result.tier} (${j.result.score}/100)`);
      router.refresh();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="px-2 py-1 rounded bg-ink-100 text-ink-700 hover:bg-ink-200 disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "↻ Recompute"}
      </button>
      {msg && <span className="text-ink-500">{msg}</span>}
    </div>
  );
}
