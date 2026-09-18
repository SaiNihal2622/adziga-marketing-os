"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrchestrateForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [goalType, setGoalType] = useState("lead_gen");
  const [goalQuantity, setGoalQuantity] = useState(500);
  const [goalMetric, setGoalMetric] = useState("qualified_leads");
  const [goalDeadline, setGoalDeadline] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [goalNotes, setGoalNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/orchestrate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, goalType, goalQuantity, goalMetric, goalDeadline, goalNotes })
    });
    setLoading(false);
    if (res.ok) {
      const plan = await res.json();
      router.push(`/app/orchestrate/${plan.planId}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Client</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">- Internal -</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Goal type</label>
          <select className="input" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
            <option value="lead_gen">Lead Generation</option>
            <option value="awareness">Awareness</option>
            <option value="conversion">Conversion</option>
            <option value="revenue">Revenue</option>
          </select>
        </div>
        <div>
          <label className="label">Quantity</label>
          <input type="number" className="input" value={goalQuantity} onChange={(e) => setGoalQuantity(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Metric</label>
          <select className="input" value={goalMetric} onChange={(e) => setGoalMetric(e.target.value)}>
            <option value="qualified_leads">Qualified Leads</option>
            <option value="impressions">Impressions</option>
            <option value="customers">Customers</option>
            <option value="revenue_inr">Revenue (INR)</option>
          </select>
        </div>
        <div>
          <label className="label">Deadline</label>
          <input type="date" className="input" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <textarea className="input" rows={2} value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} placeholder="Specific business context..." />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Generating plan..." : "Generate orchestration plan"}
        </button>
      </div>
    </form>
  );
}