// Adziga — /app/analytics/anomalies/simulate
// Sprint 11b — what-if simulator for CPL spikes.
// Pure client component; user types in "if CPL spikes X%, how does our
// CAC/ROAS change?" and we recompute on the fly against the current
// 30-day baseline (server-fetched once).

"use client";

import { useState, useMemo } from "react";

type Baseline = {
  totalLeads: number;
  totalSpend: number;
  totalCustomers: number;
  totalRevenue: number;
};

export function AnomalySimulator({ baseline }: { baseline: Baseline }) {
  const baselineCpl = baseline.totalLeads > 0 ? baseline.totalSpend / baseline.totalLeads : 0;
  const baselineCac = baseline.totalCustomers > 0 ? baseline.totalSpend / baseline.totalCustomers : 0;
  const baselineRoas = baseline.totalSpend > 0 ? baseline.totalRevenue / baseline.totalSpend : 0;
  const baselineConversion = baseline.totalLeads > 0 ? baseline.totalCustomers / baseline.totalLeads : 0;

  const [cplSpikePct, setCplSpikePct] = useState(50);
  const [leadsDropPct, setLeadsDropPct] = useState(0);
  const [spendChangePct, setSpendChangePct] = useState(0);

  const simulated = useMemo(() => {
    const factor = 1 + cplSpikePct / 100;
    const newSpend = baseline.totalSpend * (1 + spendChangePct / 100);
    // CPL goes up by factor; if leads also drop, new leads = old × (1 + leadsDrop) but
    // we approximate by saying new spend pays for fewer leads: leads_needed = newSpend / (CPL × factor)
    const newCpl = baselineCpl * factor;
    const newLeadsCount = leadsDropPct === 0
      ? baseline.totalLeads * (1 + spendChangePct / 100) // only spend change
      : baseline.totalLeads * (1 + spendChangePct / 100) * (1 - leadsDropPct / 100);
    const newCustomers = Math.round(newLeadsCount * baselineConversion);
    const newCac = newCustomers > 0 ? newSpend / newCustomers : Infinity;
    const newRoas = newSpend > 0 ? baseline.totalRevenue / newSpend : 0;

    // Δ metrics
    const deltaCac = baselineCac > 0 ? ((newCac - baselineCac) / baselineCac) * 100 : 0;
    const deltaRoas = baselineRoas > 0 ? ((newRoas - baselineRoas) / baselineRoas) * 100 : 0;
    const deltaNetRoi = (baseline.totalRevenue - baseline.totalSpend) - (baseline.totalRevenue - newSpend);

    return {
      newSpend,
      newLeadsCount,
      newCustomers,
      newCac,
      newRoas,
      deltaCac,
      deltaRoas,
      deltaNetRoi
    };
  }, [baseline, cplSpikePct, leadsDropPct, spendChangePct]);

  return (
    <div className="card-v0 p-6">
      <h3 className="text-sm font-semibold text-ink-700 mb-1">What-if simulator</h3>
      <p className="text-xs text-ink-500 mb-4">
        Stress-test your numbers against a CPL spike, lead drop, or spend change. All scenarios compute from your last 30 days of data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Slider label="CPL spike" value={cplSpikePct} onChange={setCplSpikePct} suffix="%" min={-50} max={300} step={5} hint="Cost-per-lead change" />
        <Slider label="Leads drop" value={leadsDropPct} onChange={setLeadsDropPct} suffix="%" min={-50} max={90} step={5} hint="Volume change" />
        <Slider label="Spend change" value={spendChangePct} onChange={setSpendChangePct} suffix="%" min={-50} max={200} step={5} hint="Budget change" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SimCell label="Baseline CPL" value={`₹${baselineCpl.toFixed(0)}`} />
        <SimCell label="Simulated CPL" value={`₹${(baselineCpl * (1 + cplSpikePct / 100)).toFixed(0)}`} accent />
        <SimCell label="Baseline CAC" value={baselineCac > 0 ? `₹${baselineCac.toFixed(0)}` : "—"} />
        <SimCell
          label="Simulated CAC"
          value={simulated.newCac > 0 && Number.isFinite(simulated.newCac) ? `₹${simulated.newCac.toFixed(0)}` : "—"}
          delta={simulated.deltaCac}
          tone={simulated.deltaCac > 20 ? "danger" : simulated.deltaCac > 0 ? "warn" : "good"}
        />
        <SimCell label="Baseline ROAS" value={baselineRoas > 0 ? `${baselineRoas.toFixed(2)}×` : "—"} />
        <SimCell
          label="Simulated ROAS"
          value={simulated.newRoas > 0 ? `${simulated.newRoas.toFixed(2)}×` : "—"}
          delta={simulated.deltaRoas}
          tone={simulated.deltaRoas < -20 ? "danger" : simulated.deltaRoas < 0 ? "warn" : "good"}
          invertDelta
        />
        <SimCell label="Customers (new)" value={String(simulated.newCustomers)} hint="from same window" />
        <SimCell label="Δ net ROI" value={`${simulated.deltaNetRoi >= 0 ? "+" : ""}₹${simulated.deltaNetRoi.toFixed(0)}`} tone={simulated.deltaNetRoi < 0 ? "danger" : "good"} />
      </div>

      <div className="mt-4 p-3 rounded bg-ink-50 text-xs text-ink-700">
        <strong>Verdict:</strong>{" "}
        {simulated.deltaCac > 50
          ? "CAC blows past 50% threshold. Auto-pause policies should fire — check `/app/admin/auto-approve`."
          : simulated.deltaRoas < -30
          ? "ROAS drops more than 30%. Reallocate budget toward better-performing channels via `analytics.campaignAnomalies`."
          : simulated.deltaNetRoi < 0
          ? "Net ROI turns negative. Reduce spend or pause the weakest channel."
          : "Numbers stay within healthy bounds."}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  suffix = "",
  min,
  max,
  step = 1,
  hint
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-3 bg-white">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs font-semibold text-ink-700">{label}</div>
        <div className="text-sm font-mono font-bold text-ink-900">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </div>
      </div>
      {hint && <div className="text-[10px] text-ink-500 mb-1">{hint}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[9px] text-ink-500 mt-0.5 font-mono">
        <span>{min}{suffix}</span>
        <span>0{suffix}</span>
        <span>+{max}{suffix}</span>
      </div>
    </div>
  );
}

function SimCell({
  label,
  value,
  hint,
  delta,
  tone,
  accent,
  invertDelta
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  tone?: "good" | "warn" | "danger";
  accent?: boolean;
  invertDelta?: boolean;
}) {
  const toneCls =
    tone === "danger"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : tone === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : accent
      ? "bg-brand-50 border-brand-200 text-brand-900"
      : "bg-white border-ink-200 text-ink-900";

  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wide font-medium opacity-70">{label}</div>
      <div className="text-base font-mono font-bold mt-0.5">{value}</div>
      {delta !== undefined && (
        <div className="text-[10px] font-mono mt-0.5">
          {delta > 0 ? "+" : ""}{delta.toFixed(1)}% {invertDelta ? "(lower=better)" : "(higher=better)"}
        </div>
      )}
      {hint && <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>}
    </div>
  );
}
