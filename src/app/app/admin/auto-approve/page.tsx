// Adziga — /app/admin/auto-approve
// Manage AutoApprove policies for this org. Each policy says: "if a change
// matches (entityType, action) and respects every field constraint + cap,
// auto-apply instead of queuing for review."
//
// Page sections:
//   1. Summary — how many policies active, how many auto-applies this week.
//   2. Editor — add/edit/delete policies with live "what would this do?" preview.
//   3. Feed — recent auto-applies (both minor and policy-driven) for the audit trail.

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type PolicyEntityType = "Client" | "Campaign" | "AdSet" | "Strategy" | "Integration";
type PolicyAction = "update" | "delete" | "launch" | "pause" | "archive" | "create";

type FieldConstraint = {
  field: string;
  maxDelta?: number;
  maxRelativeChange?: number;
  allowedValues?: string[];
  mustEqual?: boolean | string | number;
  pattern?: string;
};

type PolicyCaps = {
  maxPerDay?: number;
  maxPerMonth?: number;
  dryRun?: boolean;
  pauseAfterHour?: number;
  requireConfirmationWithinMinutes?: number;
};

type AutoApprovePolicy = {
  id: string;
  name: string;
  description?: string;
  entityType: PolicyEntityType;
  action: PolicyAction;
  fieldConstraints: FieldConstraint[];
  caps: PolicyCaps;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

type PolicyDecision =
  | { kind: "auto_apply"; policy: AutoApprovePolicy; reason: string }
  | { kind: "dry_run"; policy: AutoApprovePolicy; reason: string }
  | { kind: "queue"; reason: string; nearestPolicy?: AutoApprovePolicy };

type AutoApplyLogItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  severity: string;
  appliedByPolicyId: string | null;
  approver: { id: string; name: string | null; email: string } | null;
  decidedAt: string | null;
  requestedById: string;
  requestedByKind: string;
  payload: Record<string, unknown> | null;
};

const ENTITY_TYPES: PolicyEntityType[] = ["Client", "Campaign", "AdSet", "Strategy", "Integration"];
const ACTIONS: PolicyAction[] = ["update", "delete", "launch", "pause", "archive", "create"];

export default function AutoApprovePage() {
  const [policies, setPolicies] = useState<AutoApprovePolicy[]>([]);
  const [library, setLibrary] = useState<Array<{ id: string; name: string; description?: string; entityType: PolicyEntityType; action: PolicyAction }>>([]);
  const [log, setLog] = useState<AutoApplyLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<AutoApprovePolicy | null>(null);
  const [preview, setPreview] = useState<PolicyDecision | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        fetch("/api/admin/policies").then((r) => r.json()),
        fetch("/api/admin/auto-apply-log?limit=50").then((r) => r.json())
      ]);
      setPolicies(p.policies ?? []);
      setLibrary(p.library ?? []);
      setLog(l.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const startNew = () => {
    const draft: AutoApprovePolicy = {
      id: cuid(),
      name: "New policy",
      description: "",
      entityType: "Campaign",
      action: "pause",
      fieldConstraints: [{ field: "status", allowedValues: ["PAUSED"] }],
      caps: { maxPerDay: 10, dryRun: true },
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: "self"
    };
    setEditingId(draft.id);
    setEditingDraft(draft);
    setPreview(null);
  };

  const startEdit = (p: AutoApprovePolicy) => {
    setEditingId(p.id);
    setEditingDraft({ ...p });
    setPreview(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(null);
    setPreview(null);
  };

  const save = async () => {
    if (!editingDraft) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDraft)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `Save failed: ${res.status}`);
      }
      await reload();
      cancelEdit();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this policy? Auto-apply will stop immediately.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/policies?policyId=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleEnabled = async (p: AutoApprovePolicy) => {
    setError(null);
    try {
      const next = { ...p, enabled: !p.enabled };
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runPreview = async () => {
    if (!editingDraft) return;
    setPreviewing(true);
    setPreview(null);
    try {
      // Pick a recent entity of the same type as a stand-in for preview.
      const entityRes = await fetch(
        `/api/admin/policies/preview-target?entityType=${editingDraft.entityType}`
      );
      const entityJson = entityRes.ok ? await entityRes.json() : { entityId: "preview-only" };

      // Use a sample payload shaped for the constraint fields
      const samplePayload: Record<string, unknown> = {};
      for (const c of editingDraft.fieldConstraints) {
        if (c.allowedValues?.length) samplePayload[c.field] = c.allowedValues[0];
        else if (c.mustEqual !== undefined) samplePayload[c.field] = c.mustEqual;
        else samplePayload[c.field] = c.maxDelta !== undefined ? c.maxDelta : 0;
      }

      const res = await fetch("/api/admin/policies/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: editingDraft.entityType,
          entityId: entityJson.entityId,
          action: editingDraft.action,
          payload: samplePayload
        })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? "Preview failed");
      setPreview(j.decision);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="text-xs text-slate-500 mb-1">
          <Link href="/app/admin" className="hover:underline">
            Admin
          </Link>{" "}
          / Auto-approve policies
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Auto-approve policies</h1>
        <p className="text-sm text-slate-600 mt-1">
          Decide which changes apply automatically. Everything else queues for human review at{" "}
          <Link href="/app/admin/approvals" className="text-blue-600 hover:underline">
            /app/admin/approvals
          </Link>
          .
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Active policies" value={policies.filter((p) => p.enabled).length} />
        <SummaryCard label="Total policies" value={policies.length} />
        <SummaryCard
          label="Auto-applies (24h)"
          value={log.filter((l) => withinDays(l.decidedAt, 1)).length}
        />
        <SummaryCard
          label="Auto-applies (7d)"
          value={log.filter((l) => withinDays(l.decidedAt, 7)).length}
        />
      </div>

      {/* Pre-built templates (Sprint 7c) */}
      {library.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-700">Pre-built policy templates</h2>
            <span className="text-[11px] text-slate-500">{library.length} safe-by-construction templates — instantiate to add to your policy list.</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {library.map((tpl) => {
              const already = policies.some((p) => p.createdById === "template:" + tpl.id || p.createdById === ("template:" + tpl.id));
              return (
                <div key={tpl.id} className="border border-slate-200 bg-white rounded-lg p-3 space-y-1">
                  <div className="text-xs font-medium text-slate-900">{tpl.name}</div>
                  <div className="text-[11px] text-slate-600 leading-snug line-clamp-3">{tpl.description}</div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] font-mono text-slate-500">
                      {tpl.entityType}.{tpl.action}
                    </div>
                    <button
                      onClick={async () => {
                        setError(null);
                        try {
                          const res = await fetch("/api/admin/policy-library/instantiate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ templateId: tpl.id })
                          });
                          if (!res.ok) {
                            const j = await res.json().catch(() => ({}));
                            throw new Error(j.message ?? `failed: ${res.status}`);
                          }
                          await reload();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                      disabled={already}
                      className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {already ? "Added" : "Instantiate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor + list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">Policies</h2>
            <button
              onClick={startNew}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              + New policy
            </button>
          </div>

          {loading && <div className="text-sm text-slate-500">Loading…</div>}

          {!loading && policies.length === 0 && editingId === null && (
            <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-6 text-center">
              No auto-approve policies yet. Every change queues for human review.
              <br />
              Add one to start auto-applying safe changes.
            </div>
          )}

          {policies.map((p) =>
            editingId === p.id && editingDraft ? (
              <PolicyEditor
                key={p.id}
                draft={editingDraft}
                onChange={setEditingDraft}
                onCancel={cancelEdit}
                onSave={save}
                onPreview={runPreview}
                previewing={previewing}
                preview={preview}
              />
            ) : (
              <PolicyRow
                key={p.id}
                policy={p}
                onEdit={() => startEdit(p)}
                onToggle={() => toggleEnabled(p)}
                onDelete={() => remove(p.id)}
              />
            )
          )}

          {editingId !== null && editingDraft && !policies.find((p) => p.id === editingId) && (
            <PolicyEditor
              draft={editingDraft}
              onChange={setEditingDraft}
              onCancel={cancelEdit}
              onSave={save}
              onPreview={runPreview}
              previewing={previewing}
              preview={preview}
            />
          )}
        </div>

        {/* Recent auto-applies feed */}
        <div>
          <h2 className="text-sm font-medium text-slate-700 mb-3">Recent auto-applies</h2>
          {log.length === 0 ? (
            <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-4">
              No auto-applies yet.
            </div>
          ) : (
            <div className="space-y-2">
              {log.map((l) => (
                <div
                  key={l.id}
                  className="border border-slate-200 rounded-lg p-3 bg-white text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-500">
                      {l.entityType}.{l.action}
                    </span>
                    <span
                      className={
                        l.appliedByPolicyId === "MINOR_AUTO"
                          ? "text-slate-500"
                          : "text-blue-600"
                      }
                    >
                      {l.appliedByPolicyId === "MINOR_AUTO"
                        ? "minor"
                        : l.appliedByPolicyId?.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-slate-700 mt-1 line-clamp-2">{l.title}</div>
                  <div className="text-slate-400 mt-1">
                    {l.decidedAt ? relTime(l.decidedAt) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function PolicyRow({
  policy,
  onEdit,
  onToggle,
  onDelete
}: {
  policy: AutoApprovePolicy;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{policy.name}</span>
            {policy.caps.dryRun && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                dry-run
              </span>
            )}
            <span
              className={
                policy.enabled
                  ? "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-800"
                  : "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
              }
            >
              {policy.enabled ? "active" : "disabled"}
            </span>
          </div>
          {policy.description && (
            <div className="text-xs text-slate-500 mt-1">{policy.description}</div>
          )}
          <div className="text-xs text-slate-600 mt-2 font-mono">
            [{policy.entityType}.{policy.action}]
          </div>
          <div className="text-xs text-slate-600 mt-1 space-y-0.5">
            {policy.fieldConstraints.map((c, i) => (
              <div key={i} className="font-mono">
                ↳ {describeConstraint(c)}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {Object.entries(policy.caps)
              .filter(([, v]) => v !== undefined && v !== false && v !== 0)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ") || "no caps"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggle}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
          >
            {policy.enabled ? "Disable" : "Enable"}
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  onPreview,
  previewing,
  preview
}: {
  draft: AutoApprovePolicy;
  onChange: (p: AutoApprovePolicy) => void;
  onCancel: () => void;
  onSave: () => void;
  onPreview: () => void;
  previewing: boolean;
  preview: PolicyDecision | null;
}) {
  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50/40 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">
          {draft.id.length > 8 ? "Edit policy" : "New policy"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            disabled={previewing}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-white disabled:opacity-50"
          >
            {previewing ? "Running…" : "Test preview"}
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      {preview && <PreviewBanner decision={preview} />}

      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
        />
      </Field>

      <Field label="Description">
        <input
          type="text"
          value={draft.description ?? ""}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
          placeholder="optional"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Entity type">
          <select
            value={draft.entityType}
            onChange={(e) =>
              onChange({ ...draft, entityType: e.target.value as PolicyEntityType })
            }
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action">
          <select
            value={draft.action}
            onChange={(e) => onChange({ ...draft, action: e.target.value as PolicyAction })}
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-700 mb-1">Field constraints</div>
        <div className="space-y-2">
          {draft.fieldConstraints.map((c, i) => (
            <ConstraintRow
              key={i}
              constraint={c}
              onChange={(nc) => {
                const next = [...draft.fieldConstraints];
                next[i] = nc;
                onChange({ ...draft, fieldConstraints: next });
              }}
              onRemove={() => {
                onChange({
                  ...draft,
                  fieldConstraints: draft.fieldConstraints.filter((_, j) => j !== i)
                });
              }}
            />
          ))}
          <button
            onClick={() =>
              onChange({
                ...draft,
                fieldConstraints: [...draft.fieldConstraints, { field: "" }]
              })
            }
            className="text-xs px-2 py-1 rounded border border-dashed border-slate-400 text-slate-600 hover:bg-white"
          >
            + Add constraint
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-700 mb-1">Caps</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max per day">
            <input
              type="number"
              value={draft.caps.maxPerDay ?? ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  caps: {
                    ...draft.caps,
                    maxPerDay: e.target.value === "" ? undefined : Number(e.target.value)
                  }
                })
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
              min={0}
            />
          </Field>
          <Field label="Max per month">
            <input
              type="number"
              value={draft.caps.maxPerMonth ?? ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  caps: {
                    ...draft.caps,
                    maxPerMonth: e.target.value === "" ? undefined : Number(e.target.value)
                  }
                })
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
              min={0}
            />
          </Field>
          <Field label="Pause after hour (0-23)">
            <input
              type="number"
              value={draft.caps.pauseAfterHour ?? ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  caps: {
                    ...draft.caps,
                    pauseAfterHour: e.target.value === "" ? undefined : Number(e.target.value)
                  }
                })
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
              min={0}
              max={23}
            />
          </Field>
          <Field label="Confirmation within (min)">
            <input
              type="number"
              value={draft.caps.requireConfirmationWithinMinutes ?? ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  caps: {
                    ...draft.caps,
                    requireConfirmationWithinMinutes:
                      e.target.value === "" ? undefined : Number(e.target.value)
                  }
                })
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
              min={0}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs">
          <input
            type="checkbox"
            checked={!!draft.caps.dryRun}
            onChange={(e) =>
              onChange({
                ...draft,
                caps: { ...draft.caps, dryRun: e.target.checked }
              })
            }
          />
          <span className="text-slate-700">Dry-run (queue but mark "would auto-apply")</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => onChange({ ...draft, enabled: e.target.checked })}
        />
        <span className="text-slate-700">Enabled</span>
      </label>
    </div>
  );
}

function ConstraintRow({
  constraint,
  onChange,
  onRemove
}: {
  constraint: FieldConstraint;
  onChange: (c: FieldConstraint) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <input
        type="text"
        value={constraint.field}
        onChange={(e) => onChange({ ...constraint, field: e.target.value })}
        placeholder="field"
        className="col-span-3 px-2 py-1.5 rounded border border-slate-300 text-xs font-mono"
      />
      <input
        type="text"
        value={(constraint.allowedValues ?? []).join(",")}
        onChange={(e) =>
          onChange({
            ...constraint,
            allowedValues: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          })
        }
        placeholder="allowed values (comma)"
        className="col-span-3 px-2 py-1.5 rounded border border-slate-300 text-xs font-mono"
      />
      <input
        type="number"
        value={constraint.maxDelta ?? ""}
        onChange={(e) =>
          onChange({
            ...constraint,
            maxDelta: e.target.value === "" ? undefined : Number(e.target.value)
          })
        }
        placeholder="max |Δ|"
        className="col-span-2 px-2 py-1.5 rounded border border-slate-300 text-xs font-mono"
      />
      <input
        type="number"
        step={0.05}
        value={constraint.maxRelativeChange ?? ""}
        onChange={(e) =>
          onChange({
            ...constraint,
            maxRelativeChange:
              e.target.value === "" ? undefined : Number(e.target.value)
          })
        }
        placeholder="max Δ% (0-1)"
        className="col-span-2 px-2 py-1.5 rounded border border-slate-300 text-xs font-mono"
      />
      <button
        onClick={onRemove}
        className="col-span-2 text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
      >
        Remove
      </button>
    </div>
  );
}

function PreviewBanner({ decision }: { decision: PolicyDecision }) {
  if (decision.kind === "auto_apply") {
    return (
      <div className="rounded-md p-2 bg-green-50 border border-green-200 text-xs text-green-800">
        ✓ Would auto-apply under policy "{decision.policy.name}". Reason: {decision.reason}
      </div>
    );
  }
  if (decision.kind === "dry_run") {
    return (
      <div className="rounded-md p-2 bg-amber-50 border border-amber-200 text-xs text-amber-800">
        ⚠ Dry-run match — would auto-apply if dry-run were off. Reason: {decision.reason}
      </div>
    );
  }
  return (
    <div className="rounded-md p-2 bg-slate-50 border border-slate-200 text-xs text-slate-700">
      ⨯ Would queue for review. {decision.reason}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function describeConstraint(c: FieldConstraint): string {
  const parts: string[] = [`${c.field}`];
  if (c.maxDelta !== undefined) parts.push(`|Δ|≤${c.maxDelta}`);
  if (c.maxRelativeChange !== undefined)
    parts.push(`Δ≤${(c.maxRelativeChange * 100).toFixed(0)}%`);
  if (c.allowedValues?.length) parts.push(`∈{${c.allowedValues.join(",")}}`);
  if (c.mustEqual !== undefined) {
    const eq = c.mustEqual as unknown;
    if (typeof eq === "string") parts.push(`="${eq}"`);
    else parts.push(`=${JSON.stringify(eq)}`);
  }
  if (c.pattern) parts.push(`/ ${c.pattern} /`);
  return parts.join(" ");
}

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Date.now() - t < days * 86_400_000;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function cuid(): string {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
