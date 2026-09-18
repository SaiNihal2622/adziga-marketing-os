"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecommendForm({ clients }: { clients: Array<{ id: string; name: string; industry: string | null }> }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [industry, setIndustry] = useState(clients[0]?.industry ?? "Real Estate");
  const [objective, setObjective] = useState("lead_gen");
  const [monthlyBudget, setMonthlyBudget] = useState(250000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/intelligence/strategy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, industry, objective, monthlyBudget, region: "IN" })
    });
    setLoading(false);
    if (res.ok) {
      setResult(await res.json());
      router.refresh();
    } else {
      const err = await res.json();
      setResult({ error: err.error ?? "failed" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Client</label>
          <select
            className="input"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const c = clients.find((x) => x.id === e.target.value);
              if (c?.industry) setIndustry(c.industry);
            }}
          >
            <option value="">- Internal / general -</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Industry</label>
          <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Real Estate" />
        </div>
        <div>
          <label className="label">Objective</label>
          <select className="input" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="lead_gen">Lead Generation</option>
            <option value="awareness">Awareness</option>
            <option value="conversion">Conversion</option>
            <option value="revenue">Revenue</option>
          </select>
        </div>
        <div>
          <label className="label">Monthly budget ()</label>
          <input type="number" className="input" value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Computing..." : "Generate recommendation"}
        </button>
      </div>

      {result && !result.error && (
        <div className="mt-4 p-4 bg-brand-50 border border-brand-200 rounded-lg text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Recommendation</div>
            <div className={`badge ${result.confidence > 0.7 ? "badge-success" : result.confidence > 0.5 ? "badge-warning" : "badge-neutral"}`}>
              {(result.confidence * 100).toFixed(0)}% confidence
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-ink-500">Expected CPL</div><div className="font-mono font-semibold">INR {result.expectedCpl}</div></div>
            <div><div className="text-ink-500">Expected CAC</div><div className="font-mono font-semibold">INR {result.expectedCac}</div></div>
            <div><div className="text-ink-500">Expected ROAS</div><div className="font-mono font-semibold">{result.expectedRoas}x</div></div>
          </div>
          <div className="border-t border-brand-200 pt-2">
            <div className="text-xs font-semibold mb-1">Channel allocation</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {result.channels.map((c: any) => (
                <div key={c.channel} className="bg-white rounded p-1.5 text-xs flex items-center justify-between">
                  <div>{c.platform}</div>
                  <div className="font-mono">{c.allocationPct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {result?.error && (
        <div className="badge badge-danger w-full justify-start py-1.5">{result.error}</div>
      )}
    </form>
  );
}