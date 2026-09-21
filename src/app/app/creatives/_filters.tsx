// /app/creatives/_filters — search bar + format/source/campaign filters
import Link from "next/link";

const FORMATS = ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"];
const SOURCES = [
  { id: "AI_GENERATED", label: "AI generated" },
  { id: "CLIENT_UPLOAD", label: "Client upload" },
  { id: "DESIGNER", label: "Designer / Freelancer" },
  { id: "STOCK", label: "Stock" },
  { id: "USER_TEMPLATE", label: "Template" }
];

export function CreativeFilters({
  searchParams,
  campaigns,
  activeFilters
}: {
  searchParams: { status?: string; format?: string; source?: string; q?: string; campaignId?: string };
  campaigns: Array<{ id: string; name: string }>;
  activeFilters: Array<[string, string]>;
}) {
  return (
    <div className="card-v0 p-3 space-y-3">
      <form className="flex gap-2 flex-wrap items-center" action="/app/creatives" method="get">
        {/* Preserve current filters in the form */}
        {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
        {searchParams.format && <input type="hidden" name="format" value={searchParams.format} />}
        {searchParams.source && <input type="hidden" name="source" value={searchParams.source} />}
        {searchParams.campaignId && <input type="hidden" name="campaignId" value={searchParams.campaignId} />}
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search creatives by name, headline, or copy…"
            className="input pl-9 pr-3 w-full"
          />
        </div>
        <select name="format" defaultValue={searchParams.format ?? ""} className="input w-auto">
          <option value="">All formats</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select name="source" defaultValue={searchParams.source ?? ""} className="input w-auto">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {campaigns.length > 0 && (
          <select name="campaignId" defaultValue={searchParams.campaignId ?? ""} className="input w-auto max-w-[260px]">
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn-secondary">Apply</button>
      </form>
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-ink-500 self-center mr-1">Active:</span>
          {activeFilters.map(([k, v]) => (
            <Link
              key={k}
              href={removeFilterHref(searchParams, k)}
              className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-full pl-2.5 pr-1 py-0.5"
            >
              <span className="font-medium">{k}:</span> <span>{v}</span>
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href="/app/creatives" className="text-xs text-ink-500 hover:text-ink-900 ml-1 self-center">Clear all</Link>
        </div>
      )}
    </div>
  );
}

function removeFilterHref(params: Record<string, string | undefined>, key: string): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k !== key && v) next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/app/creatives${qs ? `?${qs}` : ""}`;
}
