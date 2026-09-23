"use client";

// Adziga — MaterializeStrategyButton (Sprint 18b)
// Inline client button that POSTs to /api/intelligence/strategy/[id]/materialize
// and shows the result.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MaterializeStrategyButton({ recommendationId }: { recommendationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/intelligence/strategy/${recommendationId}/materialize`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      if (j.status === "MISSING_CLIENT") {
        setMsg(`✕ Recommendation has no client attached`);
      } else if (j.status === "ALREADY_APPLIED") {
        setMsg(`✓ already applied · ${j.createdCampaigns.length} existing`);
      } else {
        setMsg(`✓ created ${j.createdCampaigns.length} campaign(s) in INTERNAL_REVIEW`);
      }
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
        onClick={onClick}
        disabled={busy}
        className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        {busy ? "Materializing…" : "Approve + materialize"}
      </button>
      {msg && <span className="text-ink-500">{msg}</span>}
    </div>
  );
}
