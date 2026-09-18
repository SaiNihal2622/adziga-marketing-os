// Adziga — Reusable chart components (no external deps)
// Pure SVG charts for sparklines, bars, donuts.

import { fmtINR, fmtNum, fmtPct } from "@/lib/format";

// ──────────────────────────────────────────────────────────────────────────
// Sparkline — minimal trend line
// ──────────────────────────────────────────────────────────────────────────
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#365efb",
  fill = true
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const areaPath = fill ? `M0,${height} L${points.split(" ").map((p) => p.replace(",", " ")).join(" L")} L${width},${height} Z` : "";

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <path d={`M0,${height} L${points.replace(/ /g, " L")} L${width},${height} Z`} fill={color} opacity="0.1" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// BarChart — horizontal bars with labels
// ──────────────────────────────────────────────────────────────────────────
export function BarChart({
  data,
  height = 200,
  formatValue = (v: number) => v.toString()
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="text-ink-700 font-medium">{d.label}</div>
              <div className="font-mono font-semibold">{formatValue(d.value)}</div>
            </div>
            <div className="h-2.5 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: d.color ?? "linear-gradient(90deg, #365efb, #d946ef)"
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DonutChart — for breakdowns
// ──────────────────────────────────────────────────────────────────────────
export function DonutChart({
  data,
  size = 160
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2;
  const stroke = 18;
  const innerR = r - stroke / 2;
  const circumference = 2 * Math.PI * innerR;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={r} cy={r} r={innerR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (d.value / total) * circumference;
          const dasharray = `${len} ${circumference - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={r}
              cy={r}
              r={innerR}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5 text-xs">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
            <div className="font-medium">{d.label}</div>
            <div className="text-ink-500">{((d.value / total) * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// LineChart — multi-series trend
// ──────────────────────────────────────────────────────────────────────────
export function LineChart({
  series,
  xLabels,
  height = 200,
  width = 600,
  yFormat = (v: number) => v.toString()
}: {
  series: Array<{ name: string; color: string; data: number[] }>;
  xLabels: string[];
  height?: number;
  width?: number;
  yFormat?: (v: number) => string;
}) {
  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(...allValues);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  function x(i: number) {
    return padding.left + (i / Math.max(1, xLabels.length - 1)) * chartW;
  }
  function y(v: number) {
    return padding.top + chartH - ((v - min) / range) * chartH;
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Y-axis grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const v = min + range * p;
        const yPos = y(v);
        return (
          <g key={p}>
            <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
            <text x={padding.left - 8} y={yPos + 4} textAnchor="end" fontSize="10" fill="#677289">{yFormat(v)}</text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {xLabels.map((label, i) => (
        <text key={i} x={x(i)} y={height - 10} textAnchor="middle" fontSize="10" fill="#677289">{label}</text>
      ))}

      {/* Series */}
      {series.map((s, idx) => {
        const points = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={idx}>
            <polyline points={points} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="white" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FunnelChart — vertical conversion funnel
// ──────────────────────────────────────────────────────────────────────────
export function FunnelChart({
  stages
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const dropoff = i > 0 && stages[i - 1].value > 0
          ? ((s.value / stages[i - 1].value) * 100).toFixed(1)
          : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <div className="text-ink-700 font-medium">{s.label}</div>
              <div className="font-mono font-semibold text-sm">{fmtNum(s.value)}</div>
            </div>
            <div className="relative h-8 bg-ink-50 rounded overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-accent-500 rounded transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
              {dropoff && (
                <div className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-ink-700">
                  {dropoff}% conversion
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}