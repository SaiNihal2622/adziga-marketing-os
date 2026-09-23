// Adziga — /app/campaigns/[id]
// Detail view with KPIs, workflow transitions (routed through approval
// when status is critical), ad sets, ads, creatives, leads, decisions,
// and UTM tracking. BigInt columns are serialized via the service.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader, StatRow } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtPct, fmtDate, fmtRelative, ctr } from "@/lib/format";
import { PLATFORM_LABELS, CAMPAIGN_STATUS_LABELS } from "@/lib/constants";
import { CampaignService } from "@/server/services/campaign-service";
import { computeCampaignHealth } from "@/server/services/campaign-health";
import { RecomputeCampaignHealthButton } from "./_recompute-campaign-health";

export const dynamic = "force-dynamic";

// Workaround — CampaignService.serializeCampaign isn't exported, so we
// duplicate the BigInt-coercion logic here for the detail page. Same logic
// as src/server/services/campaign-service.ts::serializeCampaign.
// We keep the input type loose so callers can pass a Prisma row with
// BigInt columns; the output has Number-typed metric fields and unknown
// for everything else (TS will infer member access from usage).
type SerializedCampaign<T> = Omit<T, "impressions" | "reach" | "clicks" | "leads" | "qualifiedLeads" | "customers"> & {
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  customers: number;
};

function serializeCampaign<T extends { impressions?: any; reach?: any; clicks?: any; leads?: any; qualifiedLeads?: any; customers?: any }>(c: T): SerializedCampaign<T> {
  return {
    ...c,
    impressions: Number(c.impressions ?? 0),
    reach: Number(c.reach ?? 0),
    clicks: Number(c.clicks ?? 0),
    leads: Number(c.leads ?? 0),
    qualifiedLeads: Number(c.qualifiedLeads ?? 0),
    customers: Number(c.customers ?? 0)
  };
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));

  // Status changes are "important" — they always go through approval.
  // We delegate to the service so the workflow applies uniformly.
  const result = await CampaignService.proposeUpdate(session.orgId, session.userId, id, { status: to });
  if (result.mode === "applied") {
    await audit(session.orgId, session.userId, "campaign.status_change", {
      entityType: "Campaign",
      entityId: id,
      after: { status: to }
    });
  }
}

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const c = await prisma.campaign.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      client: true,
      adSets: { include: { ads: true } },
      ads: true,
      creatives: true,
      leadEntries: { orderBy: { createdAt: "desc" }, take: 8 },
      decisions: { orderBy: { createdAt: "desc" }, take: 5 },
      experiments: true,
      reports: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!c) notFound();

  // Serialize BigInt columns. The cast keeps the relation shapes typed.
  const campaign: any = serializeCampaign(c as any);

  const cpl_ = Number(campaign.leads) > 0 ? campaign.spent / Number(campaign.leads) : 0;
  const cac_ = Number(campaign.customers) > 0 ? campaign.spent / Number(campaign.customers) : 0;
  const ro_ = campaign.spent > 0 ? campaign.revenue / campaign.spent : 0;
  const ctrPct = ctr(Number(campaign.clicks), Number(campaign.impressions));
  const budgetUtil = campaign.budget && campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;

  const nextStates = nextStatesFor(campaign.status);

  return (
    <div>
      <PageHeader
        eyebrow={campaign.client.businessName}
        title={campaign.name}
        subtitle={`${campaign.objective} · ${PLATFORM_LABELS[campaign.platform as keyof typeof PLATFORM_LABELS] ?? campaign.platform}`}
        breadcrumbs={[
          { label: "Campaigns", href: "/app/campaigns" },
          { label: campaign.name }
        ]}
        right={
          <>
            <CampaignStatusBadge status={campaign.status} />
            {campaign.health && <HealthBadge health={campaign.health} />}
            <Link href={`/app/clients/${campaign.clientId}`}>
              <Button variant="outline">View client</Button>
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Kpi label="Spend" value={fmtINR(campaign.spent)} hint={`${fmtPct(budgetUtil)} of budget`} />
        <Kpi label="Revenue" value={fmtINR(campaign.revenue)} tone="brand" />
        <Kpi label="Leads" value={fmtNum(campaign.leads)} hint={`${fmtNum(campaign.qualifiedLeads)} qualified`} />
        <Kpi label="CPL" value={fmtINR(cpl_)} tone="accent" />
        <Kpi label="Customers" value={fmtNum(campaign.customers)} hint={`${fmtINR(cac_)} CAC`} />
        <Kpi label="ROAS" value={`${ro_.toFixed(2)}×`} tone={ro_ >= 2 ? "success" : "neutral"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="Impressions" value={fmtNum(campaign.impressions)} />
        <Kpi label="Reach" value={fmtNum(campaign.reach)} />
        <Kpi label="Clicks" value={fmtNum(campaign.clicks)} />
        <Kpi label="CTR" value={fmtPct(ctrPct)} />
      </div>

      {/* Sprint 16b — Composite health panel with signal breakdown */}
      <HealthPanel campaignId={campaign.id} fallbackTier={campaign.health} />

      {/* Workflow */}
      {nextStates.length > 0 && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Workflow</h3>
              <p className="text-xs text-ink-500 mt-1">
                Status changes route through <Link href="/app/admin/approvals" className="text-brand-600 hover:underline font-medium">admin approval</Link> before applying.
              </p>
            </div>
            <Badge variant="info" dot>Adziga-controlled</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextStates.map((s) => (
              <form action={transition} key={s}>
                <input type="hidden" name="id" value={campaign.id} />
                <input type="hidden" name="to" value={s} />
                <Button variant="outline" size="sm" type="submit">
                  Move to {CAMPAIGN_STATUS_LABELS[s as keyof typeof CAMPAIGN_STATUS_LABELS] ?? s}
                </Button>
              </form>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Ad sets</h3>
            <span className="text-xs text-ink-400">{campaign.adSets.length}</span>
          </div>
          {campaign.adSets.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No ad sets yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Impressions</th>
                  <th className="px-5 py-2.5 text-right">Leads</th>
                </tr>
              </thead>
              <tbody>
                {campaign.adSets.map((a: any) => (
                  <tr key={a.id} className="border-t border-ink-100">
                    <td className="px-5 py-3 font-medium text-ink-900">{a.name}</td>
                    <td className="px-5 py-3"><Badge variant="neutral">{a.status}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(Number(a.impressions))}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(Number(a.leads))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Ads</h3>
            <span className="text-xs text-ink-400">{campaign.ads.length}</span>
          </div>
          {campaign.ads.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No ads yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Format</th>
                  <th className="px-5 py-2.5 text-right">CTR</th>
                  <th className="px-5 py-2.5 text-right">CPC</th>
                </tr>
              </thead>
              <tbody>
                {campaign.ads.map((a: any) => (
                  <tr key={a.id} className="border-t border-ink-100">
                    <td className="px-5 py-3 font-medium text-ink-900">{a.name}</td>
                    <td className="px-5 py-3 text-ink-700">{a.format}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPct(a.ctr)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtINR(a.cpc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Creatives</h3>
            <Link href="/app/creatives" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Library →</Link>
          </div>
          {campaign.creatives.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No creatives linked yet. Open the Content Agent to generate one.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {campaign.creatives.map((cr: any) => (
                <li key={cr.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/creatives/${cr.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-600 transition-colors">
                      {cr.name}
                    </Link>
                    <div className="text-xs text-ink-500 mt-0.5">{cr.format} · {cr.platform} · CTR {fmtPct(cr.ctr)}</div>
                  </div>
                  <Badge variant="neutral">{cr.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Recent leads</h3>
          </div>
          {campaign.leadEntries.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No leads captured yet.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {campaign.leadEntries.map((l: any) => (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">{l.name ?? l.email ?? "Lead"}</div>
                    <div className="text-xs text-ink-500 truncate mt-0.5">{l.source ?? "—"} · {l.city ?? "—"}</div>
                  </div>
                  <Badge variant={l.status === "CONVERTED" ? "success" : l.status === "QUALIFIED" ? "brand" : "neutral"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Decision log</h3>
            <p className="text-xs text-ink-500 mt-0.5">Strategic choices and their outcomes for this campaign</p>
          </div>
          {campaign.decisions.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No decisions logged yet.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {campaign.decisions.map((d: any) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="text-sm font-medium text-ink-900">{d.decisionType.replace(/_/g, " ")}</div>
                    <span className="text-xs text-ink-400">{fmtRelative(d.createdAt)}</span>
                  </div>
                  <div className="text-sm text-ink-700">{d.decision}</div>
                  {d.reason && <div className="text-xs text-ink-500 mt-1.5">↳ {d.reason}</div>}
                  {d.evaluation && <div className="mt-2"><Badge variant="neutral">{d.evaluation}</Badge></div>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 mb-3">Tracking & metadata</h3>
          <StatRow label="UTM Source" value={<code className="text-xs">{campaign.utmSource ?? "—"}</code>} />
          <StatRow label="UTM Medium" value={<code className="text-xs">{campaign.utmMedium ?? "—"}</code>} />
          <StatRow label="UTM Campaign" value={<code className="text-xs">{campaign.utmCampaign ?? "—"}</code>} />
          <StatRow label="External ID" value={<code className="text-xs">{campaign.externalId ?? "—"}</code>} />
          <StatRow label="Start" value={fmtDate(campaign.startDate)} />
          <StatRow label="End" value={fmtDate(campaign.endDate)} />
          <StatRow label="Created" value={fmtRelative(campaign.createdAt)} hint={fmtDate(campaign.createdAt)} />
        </Card>
      </div>
    </div>
  );
}

function nextStatesFor(s: string): string[] {
  const map: Record<string, string[]> = {
    DRAFT: ["INTERNAL_REVIEW"],
    INTERNAL_REVIEW: ["CLIENT_APPROVAL", "DRAFT"],
    CLIENT_APPROVAL: ["READY", "INTERNAL_REVIEW"],
    READY: ["ACTIVE"],
    ACTIVE: ["PAUSED", "COMPLETED"],
    PAUSED: ["ACTIVE", "COMPLETED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: []
  };
  return map[s] ?? [];
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    DRAFT: { variant: "neutral", label: "Draft" },
    INTERNAL_REVIEW: { variant: "info", label: "Internal review" },
    CLIENT_APPROVAL: { variant: "info", label: "Client approval" },
    READY: { variant: "info", label: "Ready" },
    ACTIVE: { variant: "success", label: "Active" },
    PAUSED: { variant: "warning", label: "Paused" },
    COMPLETED: { variant: "brand", label: "Completed" },
    ARCHIVED: { variant: "neutral", label: "Archived" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { variant: any }> = {
    Healthy: { variant: "success" },
    "At Risk": { variant: "warning" },
    Critical: { variant: "danger" }
  };
  const m = map[health] ?? { variant: "neutral" };
  return <Badge variant={m.variant} dot>{health}</Badge>;
}

// Sprint 16b — composite health panel. Renders the live score signals
// breakdown for this campaign. Stays async (server) so we don't have to
// hydrate an entire result back into the client; only the recompute
// button needs a client component.
async function HealthPanel({ campaignId, fallbackTier }: { campaignId: string; fallbackTier: string | null }) {
  const result = await computeCampaignHealth(campaignId);
  if (!result) return null;

  const tierVariant =
    result.tier === "Healthy"
      ? "bg-emerald-50 text-emerald-700"
      : result.tier === "At Risk"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";

  return (
    <Card padding="lg" className="mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Health</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tierVariant}`}>
              {result.tier}
            </span>
            <span className="font-mono font-semibold text-ink-900 text-sm">{result.score}/100</span>
            {fallbackTier && fallbackTier !== result.tier && (
              <span className="text-[11px] text-ink-500 font-mono">stored: {fallbackTier}</span>
            )}
          </div>
          <p className="text-xs text-ink-500 mt-1">
            Composite score from spend pacing (30), ROAS vs peer median (25), lead trend (20),
            anomaly detector (15), CTR vs platform floor (10).
          </p>
        </div>
        <RecomputeCampaignHealthButton campaignId={campaignId} />
      </div>

      <div className="space-y-2.5">
        {result.signals.map((s) => {
          const pct = (s.score / s.max) * 100;
          const barClass =
            pct >= 80
              ? "bg-emerald-500"
              : pct >= 50
                ? "bg-amber-500"
                : "bg-rose-500";
          return (
            <div key={s.key} className="grid grid-cols-[140px_1fr_72px] items-center gap-3">
              <div className="text-xs text-ink-700">{s.label}</div>
              <div className="bg-ink-100 rounded-full h-2 overflow-hidden">
                <div className={`${barClass} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs font-mono text-ink-700 text-right">
                {s.score}/{s.max}
                <span className="block text-[10px] text-ink-500 truncate" title={s.detail}>{s.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-ink-400 mt-4 font-mono">
        Computed {new Date(result.computedAt).toLocaleString()}. Click Recompute to refresh and persist.
      </div>
    </Card>
  );
}
