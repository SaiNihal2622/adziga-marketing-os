import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtNum, fmtPct, cpl, roas } from "@/lib/format";
import { PLATFORM_LABELS, CREATIVE_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function updateCreative(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const c = await prisma.creative.findFirst({ where: { id, orgId: session.orgId } });
  if (!c) return;
  const data = {
    hook: String(formData.get("hook") ?? "") || null,
    headline: String(formData.get("headline") ?? "") || null,
    primaryCopy: String(formData.get("primaryCopy") ?? "") || null,
    cta: String(formData.get("cta") ?? "") || null,
    creator: String(formData.get("creator") ?? "") || null,
    audience: String(formData.get("audience") ?? "") || null
  };
  await prisma.creative.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "creative.update", { entityType: "Creative", entityId: id, after: data });
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const c = await prisma.creative.findFirst({ where: { id, orgId: session.orgId } });
  if (!c) return;
  await prisma.creative.update({ where: { id }, data: { status: to } });
  await audit(session.orgId, session.userId, "creative.status_change", { entityType: "Creative", entityId: id, after: { status: to } });
}

export default async function CreativeDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const c = await prisma.creative.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { campaign: { include: { client: true } } }
  });
  if (!c) notFound();

  const transitions = nextStatesFor(c.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        subtitle={`${c.format} - ${PLATFORM_LABELS[c.platform as keyof typeof PLATFORM_LABELS] ?? c.platform}${c.campaign ? ` - ${c.campaign.client.businessName}` : ""}`}
        breadcrumbs={[{ label: "Creatives", href: "/app/creatives" }, { label: c.name }]}
        right={
          <>
            <StatusPill status={c.status} />
            {transitions.map((t) => (
              <form action={transition} key={t}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="to" value={t} />
                <button className="btn btn-secondary btn-sm">{CREATIVE_STATUS_LABELS[t as keyof typeof CREATIVE_STATUS_LABELS] ?? t}</button>
              </form>
            ))}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Kpi label="Impressions" value={fmtNum(c.impressions)} />
        <Kpi label="Reach" value={fmtNum(c.reach)} />
        <Kpi label="Spend" value={fmtINR(c.spend)} />
        <Kpi label="CTR" value={fmtPct(c.ctr)} />
        <Kpi label="CPC" value={fmtINR(c.cpc)} />
        <Kpi label="CPL" value={fmtINR(c.cpl)} />
        <Kpi label="Leads" value={fmtNum(c.leads)} />
        <Kpi label="Conversions" value={fmtNum(c.conversions)} />
        <Kpi label="Revenue" value={fmtINR(c.revenue)} />
        <Kpi label="ROAS" value={c.spend > 0 ? `${roas(c.revenue, c.spend).toFixed(2)}x` : "-"} />
        <Kpi label="Version" value={`v${c.version}`} />
        <Kpi label="Audience" value={c.audience ?? "-"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form action={updateCreative} className="card p-5 lg:col-span-2 space-y-4">
          <input type="hidden" name="id" value={c.id} />
          <Field label="Hook (first 3 sec / opening line)" name="hook" defaultValue={c.hook ?? ""} textarea />
          <Field label="Headline" name="headline" defaultValue={c.headline ?? ""} />
          <Field label="Primary copy" name="primaryCopy" defaultValue={c.primaryCopy ?? ""} textarea />
          <Field label="CTA" name="cta" defaultValue={c.cta ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Creator" name="creator" defaultValue={c.creator ?? ""} />
            <Field label="Audience" name="audience" defaultValue={c.audience ?? ""} />
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm">Save</button>
          </div>
        </form>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink-700">Metadata</h3>
          <Row label="Format" value={c.format} />
          <Row label="Platform" value={c.platform} />
          <Row label="Status" value={<StatusPill status={c.status} />} />
          <Row label="Version" value={`v${c.version}`} />
          <Row label="Campaign" value={c.campaign ? <Link href={`/app/campaigns/${c.campaign.id}`} className="text-brand-600 hover:underline">{c.campaign.name}</Link> : "-"} />
          {c.thumbnailUrl && (
            <div className="pt-2 border-t border-ink-100">
              <img src={c.thumbnailUrl} alt={c.name} className="rounded mt-1 w-full" />
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 bg-ink-50 border-ink-200 text-xs text-ink-600">
        <strong>Future intelligence:</strong> Every creative field here (hook, headline, copy, CTA, format,
        platform, audience) becomes input to the Phase 3 Content Intelligence engine.
      </div>
    </div>
  );
}

function Field({ label, name, defaultValue, textarea }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      {textarea ? <textarea name={name} defaultValue={defaultValue} rows={3} className="input" /> : <input name={name} defaultValue={defaultValue} className="input" />}
    </div>
  );
}
function Row({ label, value }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-ink-500">{label}</div>
      <div className="font-medium">{value}</div>
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
    DRAFT: ["REVIEW"],
    REVIEW: ["APPROVED", "DRAFT"],
    APPROVED: ["ACTIVE"],
    ACTIVE: ["PAUSED"],
    PAUSED: ["ACTIVE", "ARCHIVED"],
    ARCHIVED: []
  };
  return map[s] ?? [];
}