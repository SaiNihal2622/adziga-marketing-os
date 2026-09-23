"use client";

// Adziga — AutoPauseRunButton (Sprint 17b)
// Inline trigger — POSTs to /api/admin/auto-pause then refreshes.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AutoPauseRunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/auto-pause", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setMsg(
        `✓ ${j.total.evaluated} candidates · ${j.total.paused} paused · ${j.total.skipped} skipped${j.dryRun ? " (dry-run)" : ""}`
      );
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
        {busy ? "Running…" : "↻ Run evaluation now"}
      </button>
    </div>
  );
}
