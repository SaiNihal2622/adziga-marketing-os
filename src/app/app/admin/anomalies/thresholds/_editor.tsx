"use client";

// Adziga — AnomalyThresholdEditor (Sprint 13b)
// Client island for tuning the anomaly knobs.

import { useState } from "react";

export function AnomalyThresholdEditor({
  initial
}: {
  initial: { sigmaThreshold: number; industryCeilingMultiplier: number };
}) {
  const [sigma, setSigma] = useState(initial.sigmaThreshold);
  const [ceiling, setCeiling] = useState(initial.industryCeilingMultiplier);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/anomaly-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sigmaThreshold: sigma, industryCeilingMultiplier: ceiling })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      setMessage("✓ Saved");
    } catch (e) {
      setMessage(`✕ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-ink-200 p-3">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-xs font-semibold text-ink-700">Sigma threshold</div>
            <div className="text-sm font-mono font-bold text-ink-900">{sigma.toFixed(1)}σ</div>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-ink-500 mt-1 font-mono">
            <span>1σ</span>
            <span>2.5σ</span>
            <span>5σ</span>
          </div>
          <p className="text-[10px] text-ink-500 mt-2">Higher = only flag extreme anomalies. Lower = more sensitive.</p>
        </div>

        <div className="rounded-lg border border-ink-200 p-3">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-xs font-semibold text-ink-700">Industry-ceiling multiplier</div>
            <div className="text-sm font-mono font-bold text-ink-900">{(ceiling * 100).toFixed(0)}%</div>
          </div>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={ceiling}
            onChange={(e) => setCeiling(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-ink-500 mt-1 font-mono">
            <span>10%</span>
            <span>80%</span>
            <span>200%</span>
          </div>
          <p className="text-[10px] text-ink-500 mt-2">Auto-pause when CPL exceeds this fraction of industry-benchmark cplMax.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { setSigma(2.5); setCeiling(0.8); }}
          className="btn btn-ghost"
        >
          Reset to defaults
        </button>
        {message && <span className="text-xs text-ink-500">{message}</span>}
      </div>
    </div>
  );
}
