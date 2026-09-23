"use client";

// Adziga — AutoPausePolicyEditor (Sprint 17b)
// Client-side editor for the auto-pause policy. PUTs to /api/admin/auto-pause
// and shows a small "saved" toast.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AutoPausePolicy } from "@/server/services/auto-pause-policy";
import { Button } from "../../_components/ui";

const PLATFORMS = ["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"];

export function AutoPausePolicyEditor({
  initial,
  clients
}: {
  initial: AutoPausePolicy;
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState<AutoPausePolicy>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AutoPausePolicy>(key: K, value: AutoPausePolicy[K]) => {
    setPolicy((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const toggleClient = (id: string) => {
    const next = policy.whitelistClientIds.includes(id)
      ? policy.whitelistClientIds.filter((x) => x !== id)
      : [...policy.whitelistClientIds, id];
    update("whitelistClientIds", next);
  };

  const togglePlatform = (p: string) => {
    const next = policy.whitelistPlatforms.includes(p)
      ? policy.whitelistPlatforms.filter((x) => x !== p)
      : [...policy.whitelistPlatforms, p];
    update("whitelistPlatforms", next);
  };

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/auto-pause", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle
          label="Enabled"
          description="When off, no campaigns ever auto-pause — the panel below only shows what would happen."
          checked={policy.enabled}
          onChange={(v) => update("enabled", v)}
        />
        <Toggle
          label="Dry-run"
          description="Dry-run reports candidates without mutating Campaign.status. Live flips ACTIVE → PAUSED."
          checked={policy.dryRun}
          onChange={(v) => update("dryRun", v)}
        />
      </div>

      {/* Numeric thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-ink-100">
        <NumberField
          label="Consecutive anomaly streak"
          description="How many of the last 7/14/21-day anomaly evaluations must recommend 'pause' before this campaign becomes a candidate."
          value={policy.consecutiveAnomalyDays}
          min={1}
          max={14}
          onChange={(v) => update("consecutiveAnomalyDays", v)}
        />
        <NumberField
          label="Max pauses per run"
          description="Cap how many campaigns can flip to PAUSED in a single evaluation. Prevents runaway pauses."
          value={policy.maxPerRun}
          min={0}
          max={100}
          onChange={(v) => update("maxPerRun", v)}
        />
      </div>

      {/* Whitelists */}
      <div className="pt-3 border-t border-ink-100 space-y-4">
        <div>
          <div className="text-sm font-semibold text-ink-900 mb-2">Whitelist clients</div>
          <p className="text-xs text-ink-500 mb-3">Campaigns belonging to these clients are never paused, even if the detector says otherwise.</p>
          {clients.length === 0 ? (
            <div className="text-xs text-ink-400">No clients yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              {clients.map((c) => {
                const on = policy.whitelistClientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClient(c.id)}
                    className={`text-left text-xs px-3 py-1.5 rounded border transition-colors ${
                      on
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    {on && "✓ "}{c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold text-ink-900 mb-2">Whitelist platforms</div>
          <p className="text-xs text-ink-500 mb-3">By default all platforms are fair game. Use this to exempt, e.g., EMAIL or INFLUENCER which often have noisy data.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
            {PLATFORMS.map((p) => {
              const on = policy.whitelistPlatforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    on
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {on && "✓ "}{p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-ink-100">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save policy"}
        </Button>
        {saved && <span className="text-xs text-emerald-700">✓ saved</span>}
        {!policy.enabled && (
          <span className="text-xs text-ink-500">Currently disabled — only the table below changes when you run an evaluation.</span>
        )}
        {policy.enabled && policy.dryRun && (
          <span className="text-xs text-amber-700">Enabled + dry-run — evaluation will only report, not flip status.</span>
        )}
        {policy.enabled && !policy.dryRun && (
          <span className="text-xs text-rose-700">Live mode — evaluations will flip ACTIVE → PAUSED on matched campaigns.</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-1 inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-ink-200"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium text-ink-900">{label}</div>
        <p className="text-xs text-ink-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function NumberField({ label, description, value, min, max, onChange }: { label: string; description: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <p className="text-xs text-ink-500 mt-0.5">{description}</p>
      </label>
      <div className="flex items-center gap-3 mt-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="font-mono text-sm font-semibold text-ink-900 w-12 text-right">{value}</span>
      </div>
    </div>
  );
}
