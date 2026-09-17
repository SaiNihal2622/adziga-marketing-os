import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtNum, fmtPct, fmtDate, ctr, roas } from "@/lib/format";
import { PLATFORM_LABELS, CAMPAIGN_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const c = await prisma.campaign.findFirst({ where: { id, orgId: session.orgId } });
  if (!c) return;
  const before = { status: c.status };
  await prisma.campaign.update({ where: { id }, data: { status: to } });
  await audit(session.orgId, session.userId, "campaign.status_change", {
    entityType: "Campaign",
    entityId: id,
    before,
    after: { status: to }
  });
}

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const campaign = await prisma.campaign.findFirst({
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
  if (!campaign) notFound();

  const cpl = campaign.spent / Number(campaign.leads || 1);
  const cac = campaign.spent / Number(campaign.customers || 1);
  const ro = campaign.spent > 0 ? campaign.revenue / campaign.spent : 0;
  const ctrPct = ctr(campaign.clicks, campaign.impressions);
  const nextStates = nextStatesFor(campaign.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.objective} · ${PLATFORM_LABELS[campaign.platform as keyof typeof PLATFORM_LABELS] ?? campaign.platform} · ${campaign.client.businessName}`}
        breadcrumbs={[{ label: "Campaigns", href: "/app/campaigns" }, { label: campaign.name }]}
        right={
          <>
            <StatusPill status={campaign.status} />
            {campaign.health === "Healthy" && <span className="badge badge-success">Healthy</span>}
            {campaign.health === "At Risk" && <span className="badge badge-warning">At Risk</span>}
            {campaign.health === "Critical" && <span className="badge badge-danger">Critical</span>}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Kpi label="Spend" value={fmtINR(campaign.spent)} />
        <Kpi label="Impressions" value={fmtNum(campaign.impressions)} />
        <Kpi label="Clicks" value={fmtNum(campaign.clicks)} />
        <Kpi label="CTR" value={fmtPct(ctrPct)} />
        <Kpi label="Leads" value={fmtNum(campaign.leads)} />
        <Kpi label="Qualified" value={fmtNum(campaign.qualifiedLeads)} />
        <Kpi label="Customers" value={fmtNum(campaign.customers)} />
        <Kpi label="Revenue" value={fmtINR(campaign.revenue)} />
        <Kpi label="CPL" value={fmtINR(cpl)} />
        <Kpi label="CAC" value={fmtINR(cac)} />
        <Kpi label="ROAS" value={`${ro.toFixed(2)}x`} />
        <Kpi label="Budget util." value={fmtPct((campaign.spent / (campaign.budget || 1)) * 100)} />
      </div>

      {/* Workflow control */}
      {nextStates.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Workflow control</h3>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((s) => (
              <form action={transition} key={s}>
                <input type="hidden" name="id" value={campaign.id} />
                <input type="hidden" name="to" value={s} />
                <button className="btn btn-secondary btn-sm">{CAMPAIGN_STATUS_LABELS[s as keyof typeof CAMPAIGN_STATUS_LABELS] ?? s}</button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Ad Sets ({campaign.adSets.length})</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th className="text-right">Impressions</th><th className="text-right">Leads</th></tr></thead>
            <tbody>
              {campaign.adSets.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td><StatusPill status={a.status} /></td>
                  <td className="text-right font-mono text-xs">{fmtNum(a.impressions)}</td>
                  <td className="text-right font-mono text-xs">{fmtNum(a.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Ads ({campaign.ads.length})</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Format</th><th className="text-right">CTR</th><th className="text-right">CPC</th></tr></thead>
            <tbody>
              {campaign.ads.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.format}</td>
                  <td className="text-right font-mono text-xs">{fmtPct(a.ctr)}</td>
                  <td className="text-right font-mono text-xs">₹{a.cpc.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Creatives</h3>
            <Link href="/app/creatives" className="text-xs text-brand-600 hover:underline">All →</Link>
          </div>
          <ul className="divide-y divide-ink-100">
            {campaign.creatives.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <div>
                  <Link href={`/app/creatives/${c.id}`} className="text-sm font-medium hover:underline text-brand-600">{c.name}</Link>
                  <div className="text-xs text-ink-500">{c.format} · {c.platform} · CTR {fmtPct(c.ctr)}</div>
                </div>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent leads</h3>
          <ul className="divide-y divide-ink-100">
            {campaign.leadEntries.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{l.name ?? l.email ?? "Lead"}</div>
                  <div className="text-xs text-ink-500">{l.source} · {l.city ?? "—"}</div>
                </div>
                <StatusPill status={l.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Decision log (this campaign)</h3>
        {campaign.decisions.length === 0 && <p className="text-sm text-ink-500">No decisions logged for this campaign.</p>}
        <ul className="space-y-2">
          {campaign.decisions.map((d) => (
            <li key={d.id} className="text-sm border-l-2 border-brand-300 pl-3">
              <div className="font-medium">{d.decisionType.replace(/_/g, " ")} — {d.decision}</div>
              <div className="text-xs text-ink-500">{d.reason}</div>
              <div className="text-xs mt-1">{d.evaluation && <span className="badge badge-neutral">{d.evaluation}</span>}</div>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Link href={`/app/decisions?campaignId=${campaign.id}`} className="text-xs text-brand-600 hover:underline">Full log →</Link>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Tracking</h3>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-ink-500 text-xs">UTM Source</div><div className="font-mono">{campaign.utmSource ?? "—"}</div></div>
          <div><div className="text-ink-500 text-xs">UTM Medium</div><div className="font-mono">{campaign.utmMedium ?? "—"}</div></div>
          <div><div className="text-ink-500 text-xs">UTM Campaign</div><div className="font-mono">{campaign.utmCampaign ?? "—"}</div></div>
          <div><div className="text-ink-500 text-xs">External ID</div><div className="font-mono">{campaign.externalId ?? "—"}</div></div>
          <div><div className="text-ink-500 text-xs">Start date</div><div>{fmtDate(campaign.startDate)}</div></div>
          <div><div className="text-ink-500 text-xs">End date</div><div>{fmtDate(campaign.endDate)}</div></div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value text-lg">{value}</div>
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