"use client";

// Adziga — CostLimitsEditor (Sprint 18c)
// Inline editor for the LLM cost-alert policy. PUTs to
// /api/admin/agents/cost and POSTs to re-check after save.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/ui";

export function CostLimitsEditor({
  initial
}: {
  initial: { dailyLimit: number; weeklyLimit: number; enabled: boolean };
}) {
  const router = useRouter();
  const [daily, setDaily] = useState(initial.dailyLimit);
  const [weekly, setWeekly] = useState(initial.weeklyLimit);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const putRes = await fetch("/api/admin/agents/cost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit: daily, weeklyLimit: weekly, enabled })
      });
      if (!putRes.ok) {
        const j = await putRes.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${putRes.status}`);
      }
      // Re-run check so alerts update immediately.
      const postRes = await fetch("/api/admin/agents/cost", { method: "POST" });
      const j = await postRes.json().catch(() => ({}));
      setMsg(
        `✓ saved · cost ₹${(j.today?.cost ?? 0).toFixed(0)} today, ₹${(j.week?.cost ?? 0).toFixed(0)} this week` +
          (j.alerts?.length > 0 ? ` · ${j.alerts.length} alert(s) raised` : "")
      );
      router.refresh();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Daily limit (₹)</label>
          <input
            type="number"
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            className="block w-full mt-1 px-3 py-1.5 rounded border border-ink-200 text-sm font-mono"
            min={0}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Weekly limit (₹)</label>
          <input
            type="number"
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
            className="block w-full mt-1 px-3 py-1.5 rounded border border-ink-200 text-sm font-mono"
            min={0}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-ink-200"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <div>
              <span className="text-sm font-medium text-ink-900">Alerts enabled</span>
              <p className="text-xs text-ink-500">Raise banner when limits are crossed.</p>
            </div>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save limits"}
        </Button>
        {msg && <span className="text-xs text-ink-500">{msg}</span>}
      </div>
    </div>
  );
}
