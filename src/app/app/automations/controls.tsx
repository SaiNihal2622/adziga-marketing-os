"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AutomationControls() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  async function run(name: string) {
    setLoading(name);
    const res = await fetch("/api/automations/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    setLoading(null);
    setResults((r) => ({ ...r, [name]: data }));
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-700 mb-3">Run scheduler manually</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button disabled={loading !== null} onClick={() => run("automations.tick")} className="btn btn-primary btn-sm">
          {loading === "automations.tick" ? "Running..." : "Automation tick"}
        </button>
        <button disabled={loading !== null} onClick={() => run("campaign.health_check")} className="btn btn-secondary btn-sm">
          {loading === "campaign.health_check" ? "Running..." : "Health check"}
        </button>
        <button disabled={loading !== null} onClick={() => run("intelligence.recompute")} className="btn btn-secondary btn-sm">
          {loading === "intelligence.recompute" ? "Running..." : "Recompute intelligence"}
        </button>
        <button disabled={loading !== null} onClick={() => run("integration.health_check")} className="btn btn-secondary btn-sm">
          {loading === "integration.health_check" ? "Running..." : "Sync health"}
        </button>
      </div>
      {Object.keys(results).length > 0 && (
        <div className="mt-3 text-xs space-y-1">
          {Object.entries(results).map(([name, r]) => (
            <div key={name} className="font-mono">
              <span className="text-ink-500">{name}:</span>{" "}
              <span className={r.ok ? "text-emerald-600" : "text-rose-600"}>
                {r.ok ? `OK (${r.durationMs ?? 0}ms)` : `FAILED: ${r.error}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}