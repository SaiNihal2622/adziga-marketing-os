"use client";

// Adziga — Approvals queue (client component)
// Renders the list of approvals + approve/reject actions.
// Approve triggers the apply step server-side, so the page refreshes on next nav.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, SectionHeader, StatRow } from "@/app/app/_components/ui";
import { fmtDate, fmtRelative } from "@/lib/format";

export type ApprovalQueueItem = {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  payload: Record<string, unknown> | null;
  requestedById: string;
  requestedByKind: string;
  severity: string;
  reason: string | null;
  status: string;
  notes: string | null;
  requestedAt: string;
  decidedAt: string | null;
  approver: { id: string; name: string | null; email: string } | null;
};

type Counts = Record<string, number>;

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "applied", label: "Applied" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" }
];

export function ApprovalQueue({
  initialItems,
  counts,
  activeFilter
}: {
  initialItems: ApprovalQueueItem[];
  counts: Counts;
  activeFilter: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function filterHref(key: string) {
    return key === "pending" ? "/app/admin/approvals" : `/app/admin/approvals?status=${key}`;
  }

  function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    const notes = notesById[id] ?? "";
    startTransition(async () => {
      try {
        const res = await fetch(`/api/approvals/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, notes })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message ?? "Failed to decide approval");
          setBusyId(null);
          return;
        }
        // Refresh the list — status changed and we may need to re-route.
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: decision === "approved" ? "applied" : "rejected", notes: notes || null, decidedAt: new Date().toISOString() }
              : it
          )
        );
        setBusyId(null);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Network error");
        setBusyId(null);
      }
    });
  }

  function cancel(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/approvals/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message ?? "Failed to cancel");
          setBusyId(null);
          return;
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "cancelled", decidedAt: new Date().toISOString() } : it
          )
        );
        setBusyId(null);
      } catch (e: any) {
        alert(e?.message ?? "Network error");
        setBusyId(null);
      }
    });
  }

  return (
    <div>
      {/* Filter pills + counts */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count = counts[f.key] ?? 0;
          return (
            <Link
              key={f.key}
              href={filterHref(f.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isActive
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-200 hover:border-ink-300"
              }`}
            >
              {f.label}
              <span className={`tabular-nums ${isActive ? "text-white/70" : "text-ink-400"}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title={activeFilter === "pending" ? "Inbox zero — no pending approvals" : "Nothing here yet"}
            description={
              activeFilter === "pending"
                ? "Client-initiated changes to budgets, tiers, and campaign status will land here for review."
                : "When approvals are decided, they'll show up here by status."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* List */}
          <div className="space-y-2">
            {items.map((it) => (
              <ApprovalListItem
                key={it.id}
                item={it}
                selected={it.id === selectedId}
                onSelect={() => setSelectedId(it.id)}
              />
            ))}
          </div>

          {/* Detail pane */}
          <div className="lg:sticky lg:top-4 self-start">
            {selected ? (
              <ApprovalDetail
                item={selected}
                notes={notesById[selected.id] ?? ""}
                onNotesChange={(v) => setNotesById((s) => ({ ...s, [selected.id]: v }))}
                busy={pending && busyId === selected.id}
                onApprove={() => decide(selected.id, "approved")}
                onReject={() => decide(selected.id, "rejected")}
                onCancel={() => cancel(selected.id)}
              />
            ) : (
              <Card>
                <EmptyState title="Select an approval" description="Pick an item on the left to see its details and decide." />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalListItem({ item, selected, onSelect }: { item: ApprovalQueueItem; selected: boolean; onSelect: () => void }) {
  const tone = severityTone(item.severity);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "bg-white border-brand-300 shadow-[0_0_0_3px_rgba(243,109,33,0.10)]"
          : "bg-white border-ink-200/70 hover:border-ink-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={tone.variant} dot>
            {item.severity}
          </Badge>
          <span className="text-[10px] uppercase tracking-wide text-ink-400 font-medium">{item.entityType}</span>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="font-medium text-ink-900 text-[14.5px] leading-snug tracking-tight">{item.title}</div>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-500">
        <span>{item.requestedByKind}</span>
        <span aria-hidden>·</span>
        <span>{fmtRelative(new Date(item.requestedAt))}</span>
      </div>
    </button>
  );
}

function ApprovalDetail({
  item,
  notes,
  onNotesChange,
  busy,
  onApprove,
  onReject,
  onCancel
}: {
  item: ApprovalQueueItem;
  notes: string;
  onNotesChange: (v: string) => void;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const isPending = item.status === "pending";
  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={severityTone(item.severity).variant} dot>
              {item.severity}
            </Badge>
            <span className="text-[10px] uppercase tracking-wide text-ink-400 font-medium">{item.entityType}</span>
          </div>
          <h3 className="text-[17px] font-semibold tracking-tight text-ink-900 leading-snug">{item.title}</h3>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Metadata</div>
      <div className="rounded-lg border border-ink-200/70 bg-ink-50/40 px-4 py-1 mb-4">
        <StatRow label="Requested by" value={<span className="text-xs">{item.requestedByKind} · {item.requestedById.slice(0, 8)}</span>} />
        <StatRow label="Requested at" value={<span className="text-xs">{fmtDate(new Date(item.requestedAt))}</span>} />
        <StatRow label="Action" value={<code className="text-xs">{item.action}</code>} />
        {item.reason && <StatRow label="Reason" value={<span className="text-xs">{item.reason}</span>} />}
        {item.decidedAt && (
          <StatRow label="Decided at" value={<span className="text-xs">{fmtDate(new Date(item.decidedAt))}</span>} />
        )}
        {item.approver && (
          <StatRow label="Decided by" value={<span className="text-xs">{item.approver.name ?? item.approver.email}</span>} />
        )}
        {item.notes && <StatRow label="Decision notes" value={<span className="text-xs">{item.notes}</span>} />}
      </div>

      {item.payload && Object.keys(item.payload).length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Proposed changes</div>
          <div className="rounded-lg border border-ink-200/70 bg-white overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-ink-50/60">
                  <th className="text-left px-3 py-2 font-medium text-ink-500 w-1/3">Field</th>
                  <th className="text-left px-3 py-2 font-medium text-ink-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(item.payload).map(([k, v]) => (
                  <tr key={k} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-mono text-[11.5px] text-ink-700">{k}</td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-ink-900 break-all">{formatPayloadValue(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EntityLink entityType={item.entityType} entityId={item.entityId} />

      {isPending && (
        <>
          <div className="mt-5">
            <label className="text-xs font-medium text-ink-700 mb-1.5 block">Notes (optional, visible to client)</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Add a short justification or follow-up action…"
              className="input text-sm"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" loading={busy} disabled={busy} onClick={onApprove}>
              Approve & apply
            </Button>
            <Button variant="outline" loading={busy} disabled={busy} onClick={onReject}>
              Reject
            </Button>
            <Button variant="ghost" loading={busy} disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    pending: { variant: "warning", label: "Pending" },
    applied: { variant: "success", label: "Applied" },
    rejected: { variant: "danger", label: "Rejected" },
    cancelled: { variant: "neutral", label: "Cancelled" },
    approved: { variant: "brand", label: "Approved" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}

function severityTone(s: string) {
  switch (s) {
    case "critical":
      return { variant: "danger" as const };
    case "important":
      return { variant: "warning" as const };
    default:
      return { variant: "neutral" as const };
  }
}

function formatPayloadValue(v: unknown): string {
  if (v === null || v === undefined) return "(cleared)";
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) >= 1000) return v.toLocaleString("en-IN");
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  return JSON.stringify(v, null, 2);
}

function EntityLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  const link = entityLinkFor(entityType, entityId);
  if (!link) return null;
  return (
    <Link href={link} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium mt-2">
      Open {entityType.toLowerCase()} →
    </Link>
  );
}

function entityLinkFor(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Client":
      return `/app/clients/${entityId}`;
    case "Campaign":
      return `/app/campaigns/${entityId}`;
    case "AdSet":
      return null;
    case "Strategy":
      return `/app/strategy`;
    case "Integration":
      return `/app/admin/integrations`;
    default:
      return null;
  }
}
