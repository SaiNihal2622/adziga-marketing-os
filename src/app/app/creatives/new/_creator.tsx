"use client";

// /app/creatives/new/_creator — the actual interactive form
//
// Three modes:
//   1. AI copy   → POST /api/creatives/generate-copy → pick variant → save
//   2. AI image  → POST /api/creatives/generate-image → server creates Creative → redirect
//   3. Upload    → POST /api/uploads → fill form fields → POST /api/creatives
//   4. Hand-craft → fill form fields → POST /api/creatives

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Variant = {
  name: string;
  hook: string;
  headline: string;
  primaryCopy: string;
  cta: string;
  audience?: string;
};

const FORMATS = ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"];
const PLATFORMS = ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "LINKEDIN", "INSTAGRAM", "YOUTUBE", "GENERIC"];
const TONES = ["luxury", "playful", "trustworthy", "bold", "educational", "urgent"];
const STYLES = ["photoreal", "studio", "lifestyle", "ugc_phone_shot", "flat_lay", "infographic"];
const ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

export function CreativeCreator({
  clients,
  campaigns,
  defaultCampaignId,
  defaultClientId
}: {
  clients: Array<{ id: string; businessName: string; industry: string | null }>;
  campaigns: Array<{ id: string; name: string; client: { id: string; businessName: string } }>;
  defaultCampaignId?: string;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ai-copy" | "ai-image" | "upload" | "manual">("ai-copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <div className="card-v0 p-2 grid grid-cols-2 md:grid-cols-4 gap-1">
        {[
          { id: "ai-copy", label: "AI Copy", sub: "Generate headlines + body" },
          { id: "ai-image", label: "AI Image", sub: "Visual creative from a brief" },
          { id: "upload", label: "Upload", sub: "Client or designer file" },
          { id: "manual", label: "Hand-craft", sub: "Type the brief yourself" }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id as any); setError(null); setVariants(null); }}
            className={`p-3 rounded-lg text-left transition-all ${mode === m.id ? "bg-brand-50 ring-2 ring-brand-300" : "hover:bg-ink-50"}`}
          >
            <div className={`text-sm font-semibold ${mode === m.id ? "text-brand-900" : "text-ink-900"}`}>{m.label}</div>
            <div className="text-xs text-ink-500 mt-0.5">{m.sub}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="card-v0 p-3 bg-red-50 border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
      {warning && (
        <div className="card-v0 p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
          {warning}
        </div>
      )}

      {mode === "ai-copy" && (
        <AICopyMode
          clients={clients}
          campaigns={campaigns}
          defaultCampaignId={defaultCampaignId}
          variants={variants}
          onVariants={setVariants}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setWarning={setWarning}
        />
      )}
      {mode === "ai-image" && (
        <AIImageMode
          clients={clients}
          campaigns={campaigns}
          defaultCampaignId={defaultCampaignId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setWarning={setWarning}
          router={router}
        />
      )}
      {mode === "upload" && (
        <UploadMode
          clients={clients}
          campaigns={campaigns}
          defaultCampaignId={defaultCampaignId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          router={router}
        />
      )}
      {mode === "manual" && (
        <ManualMode
          clients={clients}
          campaigns={campaigns}
          defaultCampaignId={defaultCampaignId}
          defaultClientId={defaultClientId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          router={router}
        />
      )}
    </div>
  );
}

function AICopyMode({
  clients, campaigns, defaultCampaignId, variants, onVariants, busy, setBusy, setError, setWarning
}: any) {
  const [brief, setBrief] = useState("5 captions for a Mysore silk saree Instagram carousel targeting brides-to-be");
  const [platform, setPlatform] = useState("META");
  const [format, setFormat] = useState("IMAGE");
  const [tone, setTone] = useState("luxury");
  const [count, setCount] = useState(3);
  const [clientId, setClientId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>(defaultCampaignId ?? "");
  const [savedVariant, setSavedVariant] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setWarning(null);
    onVariants(null);
    setSavedVariant(null);
    try {
      const res = await fetch("/api/creatives/generate-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, platform, format, tone, count, clientId: clientId || undefined, campaignId: campaignId || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Generation failed");
      onVariants(data.variants);
      if (data.warning) setWarning(data.warning);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveVariant(v: Variant, idx: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          format,
          platform,
          hook: v.hook,
          headline: v.headline,
          primaryCopy: v.primaryCopy,
          cta: v.cta,
          audience: v.audience,
          source: "AI_GENERATED",
          creator: "AI (gemini-flash-latest)",
          campaignId: campaignId || undefined,
          clientId: clientId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Save failed");
      setSavedVariant(data.creative.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-v0 p-5 space-y-3">
        <h2 className="font-semibold text-sm">Tell the AI what you want</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Client" full={false}>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
              <option value="">— No client —</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </Field>
          <Field label="Campaign" full={false}>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input">
              <option value="">— No campaign —</option>
              {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
            </select>
          </Field>
          <Field label="Platform" full={false}>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Format" full={false}>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="input">
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Tone" full={false}>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="input">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="How many" full={false}>
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} className="input" />
          </Field>
        </div>
        <Field label="Brief">
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className="input" placeholder="Describe the offer, audience, angle, and any specific lines you want included." />
        </Field>
        <div className="flex justify-end">
          <button onClick={generate} disabled={busy} className="btn btn-primary">
            {busy ? "Generating…" : `Generate ${count} variant${count > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {variants && variants.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Pick a variant to save</h2>
          {variants.map((v: Variant, i: number) => (
            <div key={i} className="card-v0 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-ink-900">{v.name}</h3>
                  <p className="text-xs text-ink-500 mt-0.5">{platform} · {format} · {tone}</p>
                </div>
                {savedVariant ? (
                  <span className="text-xs text-emerald-700 font-medium">Saved ✓</span>
                ) : (
                  <button onClick={() => saveVariant(v, i)} disabled={busy} className="btn btn-secondary text-xs">Save as draft</button>
                )}
              </div>
              {v.hook && <p className="text-sm font-medium text-brand-700 mt-2">“{v.hook}”</p>}
              {v.headline && <h4 className="text-lg font-bold text-ink-900 mt-2">{v.headline}</h4>}
              <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap">{v.primaryCopy}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-ink-500">CTA:</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-brand-500 text-white text-xs font-semibold">{v.cta}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIImageMode({ clients, campaigns, defaultCampaignId, busy, setBusy, setError, setWarning, router }: any) {
  const [brief, setBrief] = useState("Hero image: model draped in bridal Mysore silk saree, soft golden hour lighting, rich red and gold fabric");
  const [style, setStyle] = useState("studio");
  const [aspect, setAspect] = useState("1:1");
  const [platform, setPlatform] = useState("META");
  const [clientId, setClientId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>(defaultCampaignId ?? "");

  async function generate() {
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/creatives/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, style, aspectRatio: aspect, platform, clientId: clientId || undefined, campaignId: campaignId || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Image generation failed");
      if (data.warning) setWarning(data.warning);
      router.push(`/app/creatives/${data.creative.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-v0 p-5 space-y-3">
      <h2 className="font-semibold text-sm">Generate an image</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Client">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">— No client —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input">
            <option value="">— No campaign —</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Style">
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="input">
            {STYLES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Aspect ratio">
          <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="input">
            {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Brief">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className="input" placeholder="Describe the scene, mood, colors, and any specific elements." />
      </Field>
      <div className="flex justify-end">
        <button onClick={generate} disabled={busy} className="btn btn-primary">
          {busy ? "Generating…" : "Generate image"}
        </button>
      </div>
      <p className="text-xs text-ink-500">
        Uses Gemini 2.0 Flash image output when available. Falls back to a branded placeholder SVG if the model is overloaded.
      </p>
    </div>
  );
}

function UploadMode({ clients, campaigns, defaultCampaignId, busy, setBusy, setError, router }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("META");
  const [format, setFormat] = useState("IMAGE");
  const [clientId, setClientId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>(defaultCampaignId ?? "");
  const [source, setSource] = useState("CLIENT_UPLOAD");

  async function submit() {
    if (!file) return setError("Pick a file first");
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/uploads?folder=creatives", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || upData.message || "Upload failed");
      const asset = upData.asset;
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || file.name,
          platform,
          format,
          source,
          creator: source === "DESIGNER" ? "Designer / Freelancer" : undefined,
          mediaUrl: asset.url,
          thumbnailUrl: asset.url,
          campaignId: campaignId || undefined,
          clientId: clientId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Save failed");
      router.push(`/app/creatives/${data.creative.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-v0 p-5 space-y-3">
      <h2 className="font-semibold text-sm">Upload a file</h2>
      <FileDrop file={file} onFile={setFile} />
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={file?.name ?? "Creative name"} /></Field>
        <Field label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input">
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
            <option value="CLIENT_UPLOAD">Client upload</option>
            <option value="DESIGNER">Designer / Freelancer</option>
            <option value="STOCK">Stock</option>
            <option value="USER_TEMPLATE">Template</option>
          </select>
        </Field>
        <Field label="Client">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">— No client —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input">
            <option value="">— No campaign —</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !file} className="btn btn-primary">
          {busy ? "Uploading…" : "Upload & save"}
        </button>
      </div>
    </div>
  );
}

function ManualMode({ clients, campaigns, defaultCampaignId, defaultClientId, busy, setBusy, setError, router }: any) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("META");
  const [format, setFormat] = useState("TEXT");
  const [hook, setHook] = useState("");
  const [headline, setHeadline] = useState("");
  const [primaryCopy, setPrimaryCopy] = useState("");
  const [cta, setCta] = useState("Learn more");
  const [audience, setAudience] = useState("");
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [campaignId, setCampaignId] = useState<string>(defaultCampaignId ?? "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, platform, format, hook, headline, primaryCopy, cta, audience,
          source: "DESIGNER", creator: "Manual brief",
          campaignId: campaignId || undefined,
          clientId: clientId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Save failed");
      router.push(`/app/creatives/${data.creative.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-v0 p-5 space-y-3">
      <h2 className="font-semibold text-sm">Hand-craft the brief</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Name" full><input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Bridal Saree — Festive Hook" /></Field>
        <Field label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input">
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Client">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">— No client —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input">
            <option value="">— No campaign —</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Audience">
          <input value={audience} onChange={(e) => setAudience(e.target.value)} className="input" placeholder="e.g. Brides-to-be 24-32, Tier-1 cities" />
        </Field>
      </div>
      <Field label="Hook"><input value={hook} onChange={(e) => setHook(e.target.value)} className="input" maxLength={80} /></Field>
      <Field label="Headline"><input value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" maxLength={60} /></Field>
      <Field label="Primary copy"><textarea value={primaryCopy} onChange={(e) => setPrimaryCopy(e.target.value)} rows={4} className="input" /></Field>
      <Field label="CTA"><input value={cta} onChange={(e) => setCta(e.target.value)} className="input" maxLength={24} /></Field>
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !name} className="btn btn-primary">
          {busy ? "Saving…" : "Save as draft"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-3" : ""}`}>
      <span className="text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function FileDrop({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-ink-50/40"}`}
    >
      <input
        type="file"
        accept="image/*,video/*,application/pdf"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      {file ? (
        <div className="text-sm">
          <div className="font-semibold text-ink-900">{file.name}</div>
          <div className="text-xs text-ink-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}</div>
        </div>
      ) : (
        <div className="text-sm text-ink-600">
          <div className="font-semibold text-ink-900">Drop your file here</div>
          <div className="text-xs mt-1">or click to browse · PNG, JPG, WebP, MP4, PDF (≤25 MB)</div>
        </div>
      )}
    </div>
  );
}
