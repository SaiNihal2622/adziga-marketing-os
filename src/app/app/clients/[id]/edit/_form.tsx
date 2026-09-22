"use client";

// Adziga — Client edit form
// Submitting critical fields (monthlyBudget, tier, status, creativePreference)
// routes through the approval workflow. The API returns { mode, ... } and
// we tell the user exactly what just happened.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/app/app/_components/ui";

type Client = {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  industry: string | null;
  websiteUrl: string | null;
  city: string | null;
  country: string | null;
  businessModel: string | null;
  monthlyBudget: number | null;
  status: string;
  tier: string;
  creativePreference: string;
  notes: string | null;
  acquisitionGoal: number | null;
  acquisitionGoalUnit: string | null;
  acquisitionGoalDeadline: string | null;
};

const CRITICAL_FIELDS = new Set(["monthlyBudget", "tier", "status", "creativePreference"]);

export function ClientEditForm({ client }: { client: Client }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | null
    | { mode: "applied"; message: string }
    | { mode: "pending"; approvalId: string; message: string; severity: string }
    | { mode: "error"; message: string }
  >(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {};
    const criticalChanges: string[] = [];
    for (const [key, val] of fd.entries()) {
      if (key === "_reason") continue;
      const v = val === "" ? null : val;
      if (v !== (client as any)[key]) {
        patch[key] = v;
        if (CRITICAL_FIELDS.has(key)) criticalChanges.push(key);
      }
    }
    if (Object.keys(patch).length === 0) {
      setResult({ mode: "error", message: "No changes to save." });
      return;
    }
    const reason = String(fd.get("_reason") ?? "").trim() || undefined;

    startTransition(async () => {
      try {
        // Convert YYYY-MM-DD deadline to ISO datetime (Z at end-of-day)
        if (patch.acquisitionGoalDeadline && typeof patch.acquisitionGoalDeadline === "string") {
          patch.acquisitionGoalDeadline = new Date(patch.acquisitionGoalDeadline + "T23:59:59.000Z").toISOString();
        }
        // Convert empty strings to null for nullable date
        if (patch.acquisitionGoalDeadline === "") {
          patch.acquisitionGoalDeadline = null;
        }

        const res = await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...patch, reason })
        });
        const body = await res.json();
        if (!res.ok) {
          setResult({ mode: "error", message: body.message ?? "Failed to save" });
          return;
        }
        if (body.mode === "applied") {
          setResult({
            mode: "applied",
            message: `Changes applied immediately: ${Object.keys(patch).join(", ")}`
          });
          router.refresh();
        } else {
          setResult({
            mode: "pending",
            approvalId: body.approval.id,
            severity: body.severity,
            message: `Staged ${criticalChanges.length} critical change${criticalChanges.length === 1 ? "" : "s"} for admin review.`
          });
        }
      } catch (e: any) {
        setResult({ mode: "error", message: e?.message ?? "Network error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Identity">
        <Field label="Business name" name="businessName" defaultValue={client.businessName} />
        <Field label="Contact name" name="contactName" defaultValue={client.contactName} />
        <Field label="Contact email" name="contactEmail" type="email" defaultValue={client.contactEmail} />
        <Field label="Phone" name="contactPhone" defaultValue={client.contactPhone ?? ""} />
      </Section>

      <Section title="Profile">
        <Field label="Industry" name="industry" defaultValue={client.industry ?? ""} />
        <Field label="Website URL" name="websiteUrl" defaultValue={client.websiteUrl ?? ""} />
        <Field label="City" name="city" defaultValue={client.city ?? ""} />
        <Field label="Country" name="country" defaultValue={client.country ?? "India"} />
        <Field label="Business model" name="businessModel" defaultValue={client.businessModel ?? ""} />
      </Section>

      <Section title="Account & creative routing" hint="Changes here require admin approval.">
        <Field
          label="Status"
          name="status"
          defaultValue={client.status}
          component="select"
          options={[
            { value: "ONBOARDING", label: "Onboarding" },
            { value: "ACTIVE", label: "Active" },
            { value: "PAUSED", label: "Paused" },
            { value: "CHURNED", label: "Churned" }
          ]}
          critical
        />
        <Field
          label="Tier"
          name="tier"
          defaultValue={client.tier}
          component="select"
          options={[
            { value: "FREE", label: "Free" },
            { value: "PRO", label: "Pro" },
            { value: "ZIGA_PLUS", label: "Ziga+" }
          ]}
          critical
        />
        <Field
          label="Monthly budget (INR)"
          name="monthlyBudget"
          type="number"
          defaultValue={client.monthlyBudget ?? 0}
          critical
        />
        <Field
          label="Creative preference"
          name="creativePreference"
          defaultValue={client.creativePreference}
          component="select"
          options={[
            { value: "AI_INHOUSE", label: "AI in-house — agent generates copy + visuals" },
            { value: "AI_DESIGNER", label: "AI + Designer — agent drafts, designer finalises" },
            { value: "MANUAL_ONLY", label: "Manual only — designer/freelancer only" }
          ]}
          hint="How the Content Agent routes creative production for this client."
          critical
        />
      </Section>

      <Section title="Acquisition goal" hint="What the client told Adziga they want to achieve. Drives the Command Center progress bar.">
        <Field
          label="Goal target"
          name="acquisitionGoal"
          type="number"
          defaultValue={client.acquisitionGoal ?? ""}
          placeholder="e.g. 500"
        />
        <Field
          label="Unit"
          name="acquisitionGoalUnit"
          defaultValue={client.acquisitionGoalUnit ?? "CUSTOMERS"}
          component="select"
          options={[
            { value: "CUSTOMERS", label: "Customers" },
            { value: "QUALIFIED_LEADS", label: "Qualified leads" },
            { value: "LEADS", label: "Leads" },
            { value: "REVENUE", label: "Revenue (₹)" }
          ]}
        />
        <Field
          label="Deadline (optional)"
          name="acquisitionGoalDeadline"
          type="date"
          defaultValue={client.acquisitionGoalDeadline ? new Date(client.acquisitionGoalDeadline).toISOString().slice(0, 10) : ""}
        />
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" name="notes" defaultValue={client.notes ?? ""} multiline />
        <Field label="Reason for change" name="_reason" placeholder="Short justification shown to the reviewer (optional)" />
      </Section>

      {result && (
        <div
          className={`rounded-lg p-4 text-sm border ${
            result.mode === "applied"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : result.mode === "pending"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {result.mode === "applied" && (
            <>
              <div className="font-medium mb-1">Applied immediately</div>
              <div>{result.message}</div>
            </>
          )}
          {result.mode === "pending" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="warning" dot>{result.severity}</Badge>
                <span className="font-medium">Staged for admin review</span>
              </div>
              <div>{result.message}</div>
              <a href="/app/admin/approvals" className="text-amber-700 underline font-medium mt-2 inline-block">
                Open the approvals queue →
              </a>
            </>
          )}
          {result.mode === "error" && <div>{result.message}</div>}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-ink-100">
        <Button type="submit" loading={pending} disabled={pending}>Save changes</Button>
        <Button variant="ghost" href={`/app/clients/${client.id}`}>Cancel</Button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
        {hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  component = "input",
  options,
  multiline,
  hint,
  critical
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: any;
  placeholder?: string;
  component?: "input" | "select";
  options?: Array<{ value: string; label: string }>;
  multiline?: boolean;
  hint?: string;
  critical?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-ink-700 mb-1 flex items-center gap-1.5">
        {label}
        {critical && <Badge variant="warning">gated</Badge>}
      </label>
      {multiline ? (
        <textarea id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} rows={3} className="input text-sm" />
      ) : component === "select" ? (
        <select id={name} name={name} defaultValue={defaultValue} className="input text-sm">
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="input text-sm" />
      )}
      {hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}
