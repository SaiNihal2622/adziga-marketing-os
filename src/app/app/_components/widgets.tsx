import Link from "next/link";

export function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up-good" | "down-good" }) {
  return (
    <div className="card p-5">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-trend ${trend === "up-good" ? "text-emerald-600" : trend === "down-good" ? "text-emerald-600" : ""}`}>{sub}</div>}
    </div>
  );
}

export function AlertCard({ kind, title, desc }: { kind: "warning" | "danger" | "info"; title: string; desc: string }) {
  const cls = kind === "danger" ? "border-l-4 border-rose-500" : kind === "warning" ? "border-l-4 border-amber-500" : "border-l-4 border-brand-500";
  return (
    <div className={`card p-4 ${cls}`}>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-sm text-ink-600 mt-1">{desc}</div>
    </div>
  );
}

export function FunnelCard({ data }: { data: Array<{ label: string; value: number; fmt: (n: number | bigint) => string }> }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value)));
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-700 mb-4">Acquisition funnel</h3>
      <ul className="space-y-3">
        {data.map((d, i) => {
          const pct = max === 0 ? 0 : (Number(d.value) / max) * 100;
          return (
            <li key={d.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="text-ink-700">{d.label}</div>
                <div className="font-mono font-medium">{d.fmt(d.value)}</div>
              </div>
              <div className="h-2 bg-ink-100 rounded">
                <div className="h-2 rounded bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${pct}%` }} />
              </div>
              {i < data.length - 1 && data[i + 1] && Number(data[i + 1].value) > 0 && (
                <div className="text-[10px] text-ink-500 mt-0.5 text-right">
                  → {((Number(d.value) / Number(data[i + 1].value || 1)) * 100).toFixed(1)}% to next
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChartBars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="h-32 flex items-end gap-1">
      {data.map((d) => {
        const h = Math.max(2, (d.value / max) * 100);
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="text-[10px] font-mono">{d.value || ""}</div>
            <div className="w-full rounded-t bg-brand-500" style={{ height: `${h}%`, minHeight: "2px" }} />
            <div className="text-[10px] text-ink-500 truncate w-full text-center">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TopListCard({
  title,
  items,
  footerLink
}: {
  title: string;
  items: Array<{ href: string; title: string; subtitle: string; value: string }>;
  footerLink?: { href: string; label: string };
}) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-700 mb-3">{title}</h3>
      {items.length === 0 && <p className="text-sm text-ink-500">Nothing here yet.</p>}
      <ul className="divide-y divide-ink-100">
        {items.slice(0, 6).map((it) => (
          <li key={it.href} className="py-2">
            <Link href={it.href} className="block hover:bg-ink-50 -mx-2 px-2 rounded">
              <div className="text-sm font-medium truncate">{it.title}</div>
              <div className="text-xs text-ink-500 truncate">{it.subtitle}</div>
              <div className="text-xs text-brand-600 font-medium mt-0.5">{it.value}</div>
            </Link>
          </li>
        ))}
      </ul>
      {footerLink && (
        <div className="mt-3 pt-3 border-t border-ink-100 text-xs">
          <Link href={footerLink.href} className="text-brand-600 hover:underline">{footerLink.label}</Link>
        </div>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "badge-success",
    PAUSED: "badge-warning",
    COMPLETED: "badge-neutral",
    DRAFT: "badge-neutral",
    INTERNAL_REVIEW: "badge-warning",
    CLIENT_APPROVAL: "badge-warning",
    READY: "badge-brand",
    ARCHIVED: "badge-neutral",
    NEW: "badge-brand",
    CONTACTED: "badge-warning",
    QUALIFIED: "badge-brand",
    MEETING_SCHEDULED: "badge-brand",
    PROPOSAL: "badge-warning",
    WON: "badge-success",
    LOST: "badge-danger",
    HEALTHY: "badge-success",
    DEGRADED: "badge-warning",
    FAILED: "badge-danger",
    DISABLED: "badge-neutral",
    SUBMITTED: "badge-brand",
    ACKNOWLEDGED: "badge-warning",
    ASSIGNED: "badge-warning",
    IN_PROGRESS: "badge-warning",
    WAITING_CLIENT: "badge-warning",
    RESOLVED: "badge-success",
    CLOSED: "badge-neutral",
    PLANNED: "badge-neutral",
    REGISTRATION_OPEN: "badge-brand",
    REGISTRATION_CLOSED: "badge-warning",
    LIVE: "badge-success",
    CANCELLED: "badge-danger",
    APPROVED: "badge-success",
    RUNNING: "badge-brand"
  };
  return <span className={`badge ${map[status] ?? "badge-neutral"}`}>{status.replace(/_/g, " ")}</span>;
}