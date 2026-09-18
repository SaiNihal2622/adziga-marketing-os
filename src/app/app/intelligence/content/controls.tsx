"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContentControls() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<any>(null);

  async function recompute() {
    setLoading("recompute");
    await fetch("/api/intelligence/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "recompute" })
    });
    setLoading(null);
    router.refresh();
  }

  async function runSuggest() {
    setLoading("suggest");
    const res = await fetch("/api/intelligence/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "suggest",
        industry: "Real Estate",
        audience: "HNI 35-55 Tier-1",
        platform: "META",
        goal: "lead_gen"
      })
    });
    setLoading(null);
    if (res.ok) setSuggest(await res.json());
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-700">Intelligence controls</h3>
        <div className="flex gap-2">
          <button onClick={recompute} disabled={loading !== null} className="btn btn-secondary btn-sm">
            {loading === "recompute" ? "Recomputing..." : "Recompute patterns"}
          </button>
          <button onClick={runSuggest} disabled={loading !== null} className="btn btn-primary btn-sm">
            {loading === "suggest" ? "Suggesting..." : "Suggest creative"}
          </button>
        </div>
      </div>
      {suggest && (
        <div className="mt-2 p-4 bg-brand-50 border border-brand-200 rounded-lg text-sm space-y-2">
          <div className="font-semibold text-brand-700">Recommended creative brief</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-ink-500">Format</div>
              <div className="font-mono">{suggest.recommendedFormat}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Hook pattern</div>
              <div className="text-xs">{suggest.recommendedHookPattern}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">CTA pattern</div>
              <div className="text-xs">{suggest.recommendedCtaPattern}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Expected CTR</div>
              <div className="font-mono">{suggest.expectedCtr}%</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Expected CPL</div>
              <div className="font-mono">INR {suggest.expectedCpl}</div>
            </div>
          </div>
          <div className="text-xs text-ink-600 border-t border-brand-200 pt-2">{suggest.rationale}</div>
        </div>
      )}
    </div>
  );
}