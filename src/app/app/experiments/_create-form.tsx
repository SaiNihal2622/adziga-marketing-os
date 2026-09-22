"use client";

// Adziga — Sprint 6 — client-side experiment create form
// Variant editor lives here so users can add/remove treatments freely.
// Variants are JSON-serialised into a hidden field on submit and the
// server action reads it.

import { useState } from "react";

type Variant = {
  kind: "CONTROL" | "TREATMENT";
  label: string;
  config: string; // free-form JSON
  weight: number;
};

const DEFAULT_VARIANTS: Variant[] = [
  { kind: "CONTROL", label: "Control", config: '{"hook": "Founder intro"}', weight: 0.5 },
  { kind: "TREATMENT", label: "Testimonial-led", config: '{"hook": "Customer testimonial"}', weight: 0.5 }
];

export function ExperimentCreateForm(props: {
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; clientName: string }>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [variants, setVariants] = useState<Variant[]>(DEFAULT_VARIANTS);

  const addVariant = () => {
    setVariants((vs) => [
      ...vs,
      { kind: "TREATMENT", label: `Variant ${vs.length}`, config: "{}", weight: 1 }
    ]);
  };
  const removeVariant = (idx: number) => {
    setVariants((vs) => vs.filter((_, i) => i !== idx));
  };
  const updateVariant = (idx: number, patch: Partial<Variant>) => {
    setVariants((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  // Cached: derive control/treatment preview text
  const control = variants.find((v) => v.kind === "CONTROL");
  const controlJson = control ? control.config : "{}";
  const treatmentJson = variants
    .filter((v) => v.kind === "TREATMENT")
    .map((v) => v.config)
    .join("\n---\n");

  return (
    <details className="card p-5" open>
      <summary className="cursor-pointer text-sm font-semibold text-ink-700 mb-3">
        + Plan new experiment
      </summary>
      <form action={props.action} className="grid md:grid-cols-3 gap-3 mt-3">
        <div className="md:col-span-2">
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="Video hook: founder vs testimonial" />
        </div>
        <div>
          <label className="label">KPI</label>
          <input name="kpi" required className="input" placeholder="qualified_lead_rate" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Hypothesis</label>
          <textarea name="hypothesis" required rows={2} className="input" placeholder="If X, then Y, because Z" />
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="input">
            <option value="">- Internal -</option>
            {props.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Campaign (optional)</label>
          <select name="campaignId" className="input">
            <option value="">- None -</option>
            {props.campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.clientName} · {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Variable being tested</label>
          <input name="variable" required className="input" placeholder="creative_hook" />
        </div>
        <div>
          <label className="label">Audience</label>
          <input name="audience" className="input" placeholder="HNI 35-55" />
        </div>
        <div>
          <label className="label">Budget (INR)</label>
          <input name="budget" type="number" className="input" />
        </div>
        <div>
          <label className="label">Duration (days)</label>
          <input name="durationDays" type="number" defaultValue={14} className="input" />
        </div>
        <div>
          <label className="label">Metric</label>
          <select name="metric" className="input" defaultValue="qualified_rate">
            <option value="qualified_rate">Qualified rate</option>
            <option value="won_rate">Won rate</option>
            <option value="revenue_per_lead">Revenue / lead</option>
          </select>
        </div>
        <div>
          <label className="label">Min sample per variant</label>
          <input name="minSampleSize" type="number" defaultValue={30} className="input" />
        </div>
        <div>
          <label className="label">Expected result</label>
          <input name="expectedResult" className="input" placeholder="+15% qualified_lead_rate" />
        </div>

        {/* Compatibility shims for the old Experiment.control/treatment text columns */}
        <input type="hidden" name="control" value={controlJson} />
        <input type="hidden" name="treatment" value={treatmentJson} />

        {/* Variants editor */}
        <div className="md:col-span-3 space-y-3">
          <div className="flex items-center justify-between pt-3 border-t border-ink-100">
            <h4 className="text-sm font-semibold text-ink-700">Variants ({variants.length})</h4>
            <button
              type="button"
              onClick={addVariant}
              className="text-xs px-3 py-1.5 rounded bg-ink-100 hover:bg-ink-200"
            >
              + Add variant
            </button>
          </div>
          {variants.map((v, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 bg-ink-50 rounded-lg">
              <div className="col-span-2">
                <label className="label">Kind</label>
                <select
                  className="input"
                  value={v.kind}
                  onChange={(e) => updateVariant(idx, { kind: e.target.value as Variant["kind"] })}
                  disabled={v.kind === "CONTROL"}
                >
                  <option value="CONTROL">Control</option>
                  <option value="TREATMENT">Treatment</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="label">Label</label>
                <input
                  className="input"
                  value={v.label}
                  onChange={(e) => updateVariant(idx, { label: e.target.value })}
                  placeholder="Founder-led"
                />
              </div>
              <div className="col-span-5">
                <label className="label">Config (JSON)</label>
                <input
                  className="input font-mono text-xs"
                  value={v.config}
                  onChange={(e) => updateVariant(idx, { config: e.target.value })}
                  placeholder='{"hook": "..."}'
                />
              </div>
              <div className="col-span-1">
                <label className="label">Weight</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="input"
                  value={v.weight}
                  onChange={(e) => updateVariant(idx, { weight: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-1 pt-6">
                {v.kind === "TREATMENT" && (
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="btn btn-ghost btn-sm text-red-600"
                    title="Remove variant"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <input
            type="hidden"
            name="variants"
            value={JSON.stringify(variants)}
          />
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button type="submit" className="btn btn-primary">
            + Plan experiment
          </button>
        </div>
      </form>
    </details>
  );
}
