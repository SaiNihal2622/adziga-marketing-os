"use client";

// Adziga — FunnelChart
// Visualizes the marketing funnel as horizontal bars with per-stage drop-off
// detection. The width of each bar is normalized to the first stage so the
// shape is always readable. Severity flags (watch / critical) come from
// FunnelService and drive the orange/red bar tint.

import Link from "next/link";
import { Badge } from "@/app/app/_components/ui";
import { fmtNum } from "@/lib/format";

// Shape mirrors FunnelService's FunnelStage. Duplicated here so this
// component stays a self-contained client module (no prisma/server imports).
type FunnelStageLocal = {
  key: string;
  label: string;
  value: number;
  conversionRate: number | null;
  dropOff: number | null;
  severity: 0 | 1 | 2;
};

type Props = {
  stages: FunnelStageLocal[];
  currency?: boolean;
  fmtValue?: (n: number) => string;
  href?: string;
};

function defaultFmt(n: number): string {
  return fmtNum(n);
}

export function FunnelChart({ stages, currency, fmtValue, href }: Props) {
  const fmt = fmtValue ?? defaultFmt;
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const conv = s.conversionRate !== null ? s.conversionRate : null;
        const sev = s.severity;
        const barColor =
          sev === 2 ? "bg-rose-400" : sev === 1 ? "bg-amber-400" : "bg-brand-500";
        const ringColor =
          sev === 2 ? "ring-rose-200" : sev === 1 ? "ring-amber-200" : "ring-brand-100";
        const isFirst = i === 0;
        const isLast = i === stages.length - 1;

        return (
          <div key={s.key} className={`rounded-lg ring-1 ${ringColor} bg-white p-3 ${!isFirst && !isLast && sev >= 1 ? "" : ""}`}>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">{s.label}</span>
                {!isFirst && conv !== null && (
                  <Badge
                    variant={sev === 2 ? "danger" : sev === 1 ? "warning" : "success"}
                    dot={sev >= 1}
                  >
                    {fmtPct(conv)}
                  </Badge>
                )}
                {s.key === "revenue" && <Badge variant="brand">terminal</Badge>}
              </div>
              <div className="flex items-baseline gap-2">
                {s.dropOff !== null && s.dropOff > 0 && (
                  <span className="text-xs text-ink-400 tabular-nums">−{fmt(s.dropOff)}</span>
                )}
                <span className="text-base font-semibold tabular-nums text-ink-900 tracking-tight">
                  {currency ? formatCurrencyShort(s.value) : fmt(s.value)}
                </span>
              </div>
            </div>
            {/* Bar */}
            <div className="relative h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Caption */}
            {!isFirst && conv !== null && (
              <div className="mt-1.5 text-[11px] text-ink-500 tabular-nums">
                {fmtPct(conv)} of previous stage
              </div>
            )}
          </div>
        );
      })}
      {href && (
        <div className="pt-1">
          <Link href={href} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Open funnel analytics →
          </Link>
        </div>
      )}
    </div>
  );
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}
