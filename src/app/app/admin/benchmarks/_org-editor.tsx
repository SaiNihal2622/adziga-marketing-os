"use client";

// Adziga — OrgBenchmarkEditor (Sprint 17c)
// Inline editor for per-org benchmark overrides. Lets an admin add an
// override (industry, channel, field, value) and remove existing ones.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgBenchmarkOverride, BenchmarkField } from "@/server/services/org-benchmark";
import { Badge, Button } from "../../_components/ui";

const FIELDS: BenchmarkField[] = ["cplMin", "cplMedian", "cplMax", "ctrMedian", "convMedian"];

const FIELD_LABELS: Record<BenchmarkField, string> = {
  cplMin: "CPL min",
  cplMedian: "CPL median",
  cplMax: "CPL max",
  ctrMedian: "CTR median",
  convMedian: "Conv median"
};

const FIELD_SUFFIX: Record<BenchmarkField, string> = {
  cplMin: "₹",
  cplMedian: "₹",
  cplMax: "₹",
  ctrMedian: "%",
  convMedian: "%"
};

export function OrgBenchmarkEditor({
  initial,
  industries,
  channels
}: {
  initial: OrgBenchmarkOverride[];
  industries: string[];
  channels: string[];
}) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<OrgBenchmarkOverride[]>(initial);
  const [industry, setIndustry] = useState<string>(industries[0] ?? "ecommerce");
  const [customIndustry, setCustomIndustry] = useState("");
  const [channel, setChannel] = useState<string>(channels[0] ?? "META");
  const [field, setField] = useState<BenchmarkField>("cplMax");
  const [value, setValue] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    const effectiveIndustry = industry === "__custom" ? customIndustry.trim() : industry;
    if (!effectiveIndustry) {
      setMsg("Industry required");
      return;
    }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0) {
      setMsg("Value must be a non-negative number");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/benchmarks/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: effectiveIndustry,
          channel,
          field,
          value: numValue,
          note: note || undefined
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setOverrides((prev) => {
        const without = prev.filter(
          (o) => !(o.industry === j.override.industry && o.channel === j.override.channel && o.field === j.override.field)
        );
        return [...without, j.override].sort(sortOverrides);
      });
      setValue("");
      setNote("");
      setMsg(`✓ set ${j.override.industry}/${j.override.channel}/${j.override.field} = ${j.override.value}`);
      router.refresh();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (o: OrgBenchmarkOverride) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/benchmarks/overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: o.industry, channel: o.channel, field: o.field })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      setOverrides((prev) => prev.filter((x) => !(x.industry === o.industry && x.channel === o.channel && x.field === o.field)));
      setMsg(`✓ removed override`);
      router.refresh();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_120px_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Industry</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm"
          >
            {industries.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
            <option value="__custom">+ custom…</option>
          </select>
          {industry === "__custom" && (
            <input
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
              placeholder="e.g. realestate"
              className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm"
            />
          )}
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Channel</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm"
          >
            {channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Field</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value as BenchmarkField)}
            className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm"
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>{FIELD_LABELS[f]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Value <span className="text-ink-400 font-mono">({FIELD_SUFFIX[field]})</span></label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 850"
            className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Note (opt)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="why"
            className="block w-full mt-1 px-2 py-1.5 rounded border border-ink-200 text-sm"
          />
        </div>
        <Button onClick={submit} disabled={busy || !value}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {msg && <div className="text-xs text-ink-500">{msg}</div>}

      {/* Existing overrides */}
      {overrides.length === 0 ? (
        <div className="py-6 text-center text-xs text-ink-500">
          No overrides yet — all benchmarks fall through to the global table above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-ink-200">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">
              <tr>
                <th className="text-left px-3 py-2">Industry</th>
                <th className="text-left px-3 py-2">Channel</th>
                <th className="text-left px-3 py-2">Field</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-left px-3 py-2">Note</th>
                <th className="text-left px-3 py-2">Updated</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={`${o.industry}::${o.channel}::${o.field}`} className="border-t border-ink-100">
                  <td className="px-3 py-2"><Badge variant="brand">{o.industry}</Badge></td>
                  <td className="px-3 py-2 text-xs font-mono">{o.channel}</td>
                  <td className="px-3 py-2 text-xs">{FIELD_LABELS[o.field]}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {o.value}{FIELD_SUFFIX[o.field]}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-600 truncate max-w-[200px]" title={o.note ?? ""}>
                    {o.note ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500 font-mono">
                    {o.updatedAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(o)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-medium"
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function sortOverrides(a: OrgBenchmarkOverride, b: OrgBenchmarkOverride): number {
  if (a.industry !== b.industry) return a.industry.localeCompare(b.industry);
  if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
  return a.field.localeCompare(b.field);
}
