"use client";

// Adziga — RecomputeCalibrationButton (Sprint 18a)
// Triggers a fresh /api/analytics/calibration POST and refreshes page.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecomputeCalibrationButton({ days }: { days: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/analytics/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setMsg(`✓ ${j.coveredCampaigns} campaigns evaluated · MAPE ${(j.overallMape * 100).toFixed(0)}%`);
      router.refresh();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {msg && <span className="text-ink-500">{msg}</span>}
      <button
        onClick={onClick}
        disabled={busy}
        className="px-3 py-1.5 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "↻ Recompute now"}
      </button>
    </div>
  );
}
