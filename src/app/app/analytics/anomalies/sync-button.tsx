"use client";

// Adziga — SyncApprovalsButton (Sprint 16a)
// Tiny client button that POSTs to /api/analytics/anomalies/sync-approvals.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncApprovalsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/analytics/anomalies/sync-approvals", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setResult(`✓ ${j.created} new approval(s) created · ${j.pauseCandidates} pause + ${j.scaleCandidates} scale candidates`);
      router.refresh();
    } catch (e) {
      setResult(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={onClick}
        disabled={busy}
        className="px-2 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {busy ? "Syncing…" : "↑ Create approval tickets"}
      </button>
      {result && <span className="text-ink-500">{result}</span>}
    </div>
  );
}
