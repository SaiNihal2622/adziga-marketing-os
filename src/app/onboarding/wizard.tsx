"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = { key: string; title: string; desc: string };

export function OnboardingWizard({ steps }: { steps: Step[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const step = steps[i];
  const last = i === steps.length - 1;

  function set(k: string, v: string) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function next() {
    if (i < steps.length - 1) setI(i + 1);
  }
  function prev() {
    if (i > 0) setI(i - 1);
  }

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/login?onboarded=1");
    }
  }

  return (
    <div className="card p-8 fade-in">
      {/* progress */}
      <div className="flex items-center justify-between text-xs text-ink-500 mb-4">
        <div>Step {i + 1} of {steps.length}</div>
        <div>{Math.round(((i + 1) / steps.length) * 100)}% complete</div>
      </div>
      <div className="w-full bg-ink-100 rounded-full h-1.5 mb-6">
        <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>

      <h1 className="text-2xl font-semibold mb-1">{step.title}</h1>
      <p className="text-ink-600 mb-6">{step.desc}</p>

      <textarea
        className="input min-h-[140px] font-mono text-sm"
        placeholder="Type your answer here..."
        value={data[step.key] || ""}
        onChange={(e) => set(step.key, e.target.value)}
      />

      <div className="flex items-center justify-between mt-6">
        <button onClick={prev} disabled={i === 0} className="btn btn-ghost">
           Back
        </button>
        <div className="flex gap-2">
          {!last && (
            <button onClick={next} disabled={!data[step.key]} className="btn btn-primary">
              Next 
            </button>
          )}
          {last && (
            <button onClick={submit} disabled={!data[step.key] || submitting} className="btn btn-primary">
              {submitting ? "Submitting..." : "Submit & continue"}
            </button>
          )}
        </div>
      </div>

      {/* step pills */}
      <div className="mt-8 pt-6 border-t border-ink-200 grid grid-cols-5 gap-2">
        {steps.map((s, idx) => (
          <button
            key={s.key}
            onClick={() => setI(idx)}
            className={`text-left text-[11px] p-2 rounded ${
              idx === i ? "bg-brand-50 border border-brand-200" : "hover:bg-ink-50"
            }`}
          >
            <div className="text-ink-500">Step {idx + 1}</div>
            <div className="font-medium text-ink-700 truncate">{s.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}