"use client";

// /app/studio/briefs/new/_form — actual interactive form
import { useRouter } from "next/navigation";
import { useState } from "react";

const FORMATS = ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"];
const PLATFORMS = ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "LINKEDIN", "INSTAGRAM", "YOUTUBE", "GENERIC"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function BriefForm({
  clients,
  campaigns,
  designers,
  defaultClientId,
  defaultCampaignId
}: {
  clients: Array<{ id: string; businessName: string }>;
  campaigns: Array<{ id: string; name: string; client: { id: string; businessName: string } }>;
  designers: Array<{ id: string; name: string | null; email: string; image: string | null }>;
  defaultClientId?: string;
  defaultCampaignId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter campaigns by selected client
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const referenceUrls = (fd.get("referenceUrls") as string ?? "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const dueDateRaw = (fd.get("dueDate") as string ?? "").trim();
    const body: any = {
      clientId: (fd.get("clientId") as string) || undefined,
      campaignId: (fd.get("campaignId") as string) || undefined,
      title: fd.get("title"),
      brief: fd.get("brief"),
      format: fd.get("format"),
      platform: fd.get("platform"),
      priority: fd.get("priority") ?? "NORMAL",
      dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
      referenceUrls,
      copyDirection: (fd.get("copyDirection") as string) || undefined,
      assigneeId: (fd.get("assigneeId") as string) || undefined
    };

    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to create brief");
      router.push(`/app/studio/briefs/${data.brief.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="card-v0 p-3 bg-red-50 border-red-200 text-sm text-red-800">{error}</div>}

      <div className="card-v0 p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Client" full>
            <select name="clientId" defaultValue={defaultClientId ?? ""} className="input">
              <option value="">— No client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </Field>
          <Field label="Campaign" full>
            <select name="campaignId" defaultValue={defaultCampaignId ?? ""} className="input">
              <option value="">— No campaign —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Title">
          <input name="title" required maxLength={200} className="input" placeholder="e.g. Bridal saree carousel — 5 slides" />
        </Field>

        <Field label="Brief — describe what you need, brand voice, audience, examples">
          <textarea name="brief" required minLength={10} maxLength={8000} rows={6} className="input" placeholder="Write the creative brief here. Markdown is supported." />
        </Field>

        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Format">
            <select name="format" defaultValue="IMAGE" className="input">
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Platform">
            <select name="platform" defaultValue="META" className="input">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue="NORMAL" className="input">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Due date">
            <input name="dueDate" type="date" className="input" />
          </Field>
          <Field label="Assign to (optional — leave open for designers to claim)">
            <select name="assigneeId" defaultValue="" className="input">
              <option value="">— Open (anyone can claim) —</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? d.email}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Copy direction (optional — headline, hook, CTA hints)">
          <textarea name="copyDirection" maxLength={2000} rows={2} className="input" placeholder={"e.g. \"Headline must say 'Pure Mysore silk' verbatim. CTA: Shop now.\""} />
        </Field>

        <Field label="Reference URLs (one per line — client brand kits, prior creatives, mood boards)">
          <textarea name="referenceUrls" rows={3} className="input font-mono text-xs" placeholder="https://drive.google.com/...&#10;https://figma.com/file/..." />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Creating…" : "Create brief"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}
