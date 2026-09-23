// Adziga — /app/leads/tags
// Sprint 15b — tag analytics dashboard. Shows distribution of every tag
// across the lead base, with quality-tier and source-channel breakdowns.

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtNum, fmtPct } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [7, 30, 90, 365] as const;

type TagBucket = { tag: string; n: number };

export default async function LeadTagsPage({
  searchParams
}: {
  searchParams: { days?: string };
}) {
  const session = await requireSession();
  const days = (DAY_OPTIONS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 30;
  const since = new Date(Date.now() - days * 86_400_000);

  // Pull all tag strings for leads created in the window.
  const rows = await prisma.lead.findMany({
    where: { orgId: session.orgId, createdAt: { gte: since } },
    select: { tags: true, status: true, source: true }
  });

  const totalLeads = rows.length;

  // Bucket tags by category prefix.
  const tagCounts = new Map<string, number>();
  const leadsByQuality = { hot: 0, warm: 0, cold: 0, untagged: 0 };
  const leadsBySource: Record<string, number> = {};
  const leadsByIndustry: Record<string, number> = {};
  const leadsByRegion: Record<string, number> = {};

  for (const r of rows) {
    const tags = (r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) leadsByQuality.untagged++;
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      if (tag === "quality:hot") leadsByQuality.hot++;
      if (tag === "quality:warm") leadsByQuality.warm++;
      if (tag === "quality:cold") leadsByQuality.cold++;
      if (tag.startsWith("source:")) {
        const v = tag.slice("source:".length);
        leadsBySource[v] = (leadsBySource[v] ?? 0) + 1;
      }
      if (tag.startsWith("industry:")) {
        const v = tag.slice("industry:".length);
        leadsByIndustry[v] = (leadsByIndustry[v] ?? 0) + 1;
      }
      if (tag.startsWith("region:")) {
        const v = tag.slice("region:".length);
        leadsByRegion[v] = (leadsByRegion[v] ?? 0) + 1;
      }
    }
  }

  const topTags: TagBucket[] = Array.from(tagCounts.entries())
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n);

  // Conversion rate by quality tier (best signal of whether tagging actually helps)
  const qualityOutcomes = await prisma.$queryRaw<Array<{
    tier: string;
    n: bigint;
    qualified: bigint;
    won: bigint;
  }>>`
    WITH tagged AS (
      SELECT id,
             CASE
               WHEN tags LIKE '%quality:hot%' THEN 'hot'
               WHEN tags LIKE '%quality:warm%' THEN 'warm'
               WHEN tags LIKE '%quality:cold%' THEN 'cold'
               ELSE 'untagged'
             END AS tier
      FROM "Lead"
      WHERE "orgId" = ${session.orgId} AND "createdAt" >= ${since}
    )
    SELECT t.tier,
           COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE l.status IN ('QUALIFIED','MEETING_SCHEDULED','PROPOSAL','WON'))::bigint AS qualified,
           COUNT(*) FILTER (WHERE l.status = 'WON')::bigint AS won
    FROM tagged t
    JOIN "Lead" l ON l.id = t.id
    GROUP BY t.tier
  `.catch(() => [] as any[]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead tag analytics"
        subtitle="Distribution of tags from Sprint 9a's auto-tagger. Useful for sanity-checking that the heuristic is actually classifying leads well."
        eyebrow="Marketing OS"
        breadcrumbs={[{ label: "Leads", href: "/app/leads" }, { label: "Tags" }]}
        right={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-500 mr-1">Window:</span>
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`?days=${d}`}
                className={`px-2 py-1 rounded ${d === days ? "bg-ink-900 text-white" : "bg-ink-100 hover:bg-ink-200"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Leads" value={fmtNum(totalLeads)} hint={`last ${days} days`} />
        <Kpi label="Tagged leads" value={fmtNum(totalLeads - leadsByQuality.untagged)} hint={`${fmtPct(totalLeads ? (totalLeads - leadsByQuality.untagged) / totalLeads : 0, 1)} coverage`} tone="success" />
        <Kpi label="Hot" value={fmtNum(leadsByQuality.hot)} tone="accent" hint="quality:hot" />
        <Kpi label="Cold" value={fmtNum(leadsByQuality.cold)} hint="quality:cold" />
      </div>

      {/* Quality-tier conversion rates — best validation that tagging helps */}
      <SectionHeader title="Quality tier → conversion" description="Conversion rate by tag tier. If hot converts better than cold, the tagger is doing useful work." />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Tier</th>
                <th className="text-right">n</th>
                <th className="text-right">Qualified</th>
                <th className="text-right">Qual rate</th>
                <th className="text-right">Won</th>
                <th className="text-right">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {qualityOutcomes.map((row) => {
                const tier = row.tier;
                const total = Number(row.n);
                const qual = Number(row.qualified);
                const won = Number(row.won);
                return (
                  <tr key={tier} className="border-b border-ink-100">
                    <td className="px-4 py-2 font-medium">
                      <Badge variant={tier === "hot" ? "success" : tier === "warm" ? "warning" : tier === "cold" ? "neutral" : "accent"}>
                        {tier}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{fmtNum(total)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtNum(qual)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(total ? qual / total : 0, 1)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtNum(won)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(total ? won / total : 0, 1)}</td>
                  </tr>
                );
              })}
              {qualityOutcomes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-500 py-6">
                    No leads in this window. Once leads arrive with tags, conversion rates by tier will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top tags */}
      <SectionHeader title="Top tags" description={`${topTags.length} distinct tags across ${totalLeads} leads`} />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Tag</th>
                <th className="text-right">Leads</th>
                <th className="text-right">% of total</th>
              </tr>
            </thead>
            <tbody>
              {topTags.slice(0, 25).map((t) => (
                <tr key={t.tag} className="border-b border-ink-100">
                  <td className="px-4 py-2">
                    <Badge variant={tagVariant(t.tag)}>{t.tag}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmtNum(t.n)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(totalLeads ? t.n / totalLeads : 0, 1)}</td>
                </tr>
              ))}
              {topTags.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-ink-500 py-6">No tags yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Distribution breakdowns */}
      <div className="grid md:grid-cols-3 gap-4">
        <DistCard title="By source" map={leadsBySource} total={totalLeads} />
        <DistCard title="By industry" map={leadsByIndustry} total={totalLeads} />
        <DistCard title="By region" map={leadsByRegion} total={totalLeads} />
      </div>
    </div>
  );
}

function tagVariant(t: string): "neutral" | "brand" | "success" | "warning" | "accent" | "info" {
  if (t.startsWith("quality:hot")) return "success";
  if (t.startsWith("quality:cold")) return "neutral";
  if (t.startsWith("quality:warm")) return "warning";
  if (t.startsWith("source:paid")) return "warning";
  if (t.startsWith("source:organic")) return "info";
  if (t.startsWith("source:email")) return "brand";
  if (t.startsWith("region:tier1")) return "success";
  if (t.startsWith("region:tier2")) return "neutral";
  if (t.startsWith("industry:")) return "info";
  return "neutral";
}

function DistCard({ title, map, total }: { title: string; map: Record<string, number>; total: number }) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink-700 mb-2">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-500 text-center py-3">No data.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {entries.slice(0, 8).map(([k, n]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="font-mono text-ink-700 truncate max-w-[60%]">{k}</span>
              <div className="flex-1 h-2 rounded bg-ink-100 overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
              <span className="font-mono text-ink-700 w-12 text-right">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
