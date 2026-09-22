// Adziga — /app/intelligence/precedents
// Search the org's institutional memory. The Strategy Agent calls this
// automatically before recommending; this UI lets the team query directly.

import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Card } from "@/app/app/_components/ui";
import { requireSession } from "@/lib/session";
import { RetrievalService } from "@/server/services/retrieval-service";

export const dynamic = "force-dynamic";

export default async function PrecedentsPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  const session = await requireSession();
  const q = searchParams.q ?? "";
  const precedents = q ? await RetrievalService.search({ orgId: session.orgId, query: q, limit: 20 }) : [];

  const groups = new Map<string, typeof precedents>();
  for (const p of precedents) {
    const list = groups.get(p.kind) ?? [];
    list.push(p);
    groups.set(p.kind, list);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="Precedent"
        subtitle="Search past decisions, experiments, approvals, lead outcomes, and campaign outcomes across the org."
        breadcrumbs={[{ label: "Intelligence", href: "/app/intelligence" }, { label: "Precedent" }]}
      />

      <form action="/app/intelligence/precedents" method="GET" className="mb-6">
        <Card padding="sm">
          <div className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Try: budget reallocation, creative fatigue, WhatsApp qualified rate…"
              className="input flex-1"
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              "creative fatigue",
              "budget reallocation",
              "WhatsApp broadcast",
              "influencer outreach",
              "lead scoring",
              "Meta retargeting"
            ].map((s) => (
              <a
                key={s}
                href={`/app/intelligence/precedents?q=${encodeURIComponent(s)}`}
                className="px-2 py-0.5 rounded-full text-xs bg-ink-50 border border-ink-200 text-ink-700 hover:bg-ink-100 transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </Card>
      </form>

      {!q ? (
        <Card>
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 text-brand-600 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4-6.5 4 2-7L2 9h7l3-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </div>
            <h3 className="font-semibold text-ink-900">Search institutional memory</h3>
            <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
              Every decision, experiment, lead outcome, and campaign outcome is searchable here. The Strategy Agent calls this automatically before recommending an action.
            </p>
          </div>
        </Card>
      ) : precedents.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4-4m2-6a8 8 0 11-16 0 8 8 0 0116 0z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </div>
            <h3 className="font-semibold text-ink-900">No precedent found</h3>
            <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
              Nothing in the org's memory matches "{q}". This is the first time you're facing this situation — capture the outcome so future agents learn from it.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([kind, items]) => (
            <div key={kind}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[14px] font-semibold tracking-tight text-ink-900">{humanizeKind(kind)}</h3>
                <Badge variant="neutral">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <Card key={`${p.kind}-${p.id}`} padding="md">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={outcomeVariant(p.refs.outcomeType)} dot>
                            {p.refs.outcomeType ?? "neutral"}
                          </Badge>
                          <span className="text-[10px] uppercase tracking-wide text-ink-400 font-medium">{p.kind.replace("_", " ")}</span>
                        </div>
                        <div className="text-[14px] font-medium text-ink-900 mt-1">{p.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase tracking-wide text-ink-500 font-medium">Similarity</div>
                        <div className="text-sm font-semibold tabular-nums text-ink-900">{(p.similarity * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    {p.summary && <p className="text-sm text-ink-600 leading-relaxed">{p.summary}</p>}
                    {p.context && <p className="text-xs text-ink-500 mt-1.5 italic">{p.context}</p>}
                    {p.outcome && (
                      <div className="mt-2 pt-2 border-t border-ink-100 text-xs text-ink-700">
                        <span className="font-semibold text-ink-500 uppercase tracking-wide text-[10px] mr-1.5">Outcome</span>
                        {p.outcome}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-ink-500">
                      <span>{fmtRel(p.when)}</span>
                      {p.refs.clientName && <span>· {p.refs.clientName}</span>}
                      {p.refs.campaignName && <span>· {p.refs.campaignName}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function humanizeKind(k: string): string {
  return {
    decision: "Past decisions",
    experiment: "Past experiments",
    approval: "Approved/rejected changes",
    strategy: "Strategy versions",
    lead_outcome: "Lead outcomes",
    campaign_outcome: "Campaign outcomes"
  }[k] ?? k;
}

function outcomeVariant(o?: string): "success" | "warning" | "danger" | "neutral" {
  if (o === "success") return "success";
  if (o === "failure") return "danger";
  return "neutral";
}

function fmtRel(d: Date): string {
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
