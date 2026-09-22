"use client";

// Adziga — BenchmarkEditor (Sprint 14b)

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BenchmarkEditor() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    industry: "",
    objective: "lead_generation",
    channel: "META",
    cplMin: 0,
    cplMedian: 0,
    cplMax: 0,
    ctrMedian: 0,
    convMedian: 0,
    sampleSize: 0,
    region: "IN"
  });

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cplMin: Number(form.cplMin), cplMedian: Number(form.cplMedian), cplMax: Number(form.cplMax), ctrMedian: Number(form.ctrMedian), convMedian: Number(form.convMedian), sampleSize: Number(form.sampleSize) })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      setMessage("✓ Saved");
      router.refresh();
    } catch (e) {
      setMessage(`✕ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Industry">
          <input className="input" placeholder="ecommerce" value={form.industry} onChange={(e) => update("industry", e.target.value)} />
        </Field>
        <Field label="Objective">
          <select className="input" value={form.objective} onChange={(e) => update("objective", e.target.value)}>
            <option value="lead_generation">Lead generation</option>
            <option value="conversions">Conversions</option>
            <option value="traffic">Traffic</option>
            <option value="awareness">Awareness</option>
          </select>
        </Field>
        <Field label="Channel">
          <select className="input" value={form.channel} onChange={(e) => update("channel", e.target.value)}>
            {["META", "GOOGLE", "WHATSAPP", "INSTAGRAM", "YOUTUBE", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <input className="input" value={form.region} onChange={(e) => update("region", e.target.value)} />
        </Field>
        <Field label="CPL min (₹)">
          <input type="number" className="input" value={form.cplMin} onChange={(e) => update("cplMin", e.target.value)} />
        </Field>
        <Field label="CPL median (₹)">
          <input type="number" className="input" value={form.cplMedian} onChange={(e) => update("cplMedian", e.target.value)} />
        </Field>
        <Field label="CPL max (₹)">
          <input type="number" className="input" value={form.cplMax} onChange={(e) => update("cplMax", e.target.value)} />
        </Field>
        <Field label="Sample size">
          <input type="number" className="input" value={form.sampleSize} onChange={(e) => update("sampleSize", e.target.value)} />
        </Field>
        <Field label="CTR median (0..1)">
          <input type="number" step="0.001" className="input" value={form.ctrMedian} onChange={(e) => update("ctrMedian", e.target.value)} />
        </Field>
        <Field label="Conv median (0..1)">
          <input type="number" step="0.001" className="input" value={form.convMedian} onChange={(e) => update("convMedian", e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={saving || !form.industry} className="btn btn-primary">
          {saving ? "Saving…" : "Upsert"}
        </button>
        {message && <span className="text-xs text-ink-500">{message}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink-500 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </label>
  );
}
