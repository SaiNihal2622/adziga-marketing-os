"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectorControls() {
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

  const jobs = [
    { name: "automations.tick", label: "Automation tick (score + route leads)" },
    { name: "campaign.health_check", label: "Campaign health check" },
    { name: "intelligence.recompute", label: "Intelligence recompute" },
    { name: "integration.health_check", label: "Integration health check" }
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-700 mb-3">Run background jobs manually</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {jobs.map((j) => (
          <button key={j.name} disabled={loading !== null} onClick={() => run(j.name)} className="btn btn-secondary btn-sm">
            {loading === j.name ? "Running..." : j.label}
          </button>
        ))}
      </div>
      {Object.keys(results).length > 0 && (
        <div className="mt-3 text-xs space-y-1">
          {Object.entries(results).map(([name, r]) => (
            <div key={name} className="font-mono">
              <span className="text-ink-500">{name}:</span>{" "}
              <span className={r.ok ? "text-emerald-600" : "text-rose-600"}>{r.ok ? "OK" : `FAILED: ${r.error}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}