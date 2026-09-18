import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtDate } from "@/lib/format";
import { STRATEGY_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function updateStrategy(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const s = await prisma.strategy.findFirst({ where: { id, orgId: session.orgId } });
  if (!s) return;
  const data = {
    businessObjective: String(formData.get("businessObjective") ?? "") || null,
    targetAudience: String(formData.get("targetAudience") ?? "") || null,
    market: String(formData.get("market") ?? "") || null,
    offer: String(formData.get("offer") ?? "") || null,
    positioning: String(formData.get("positioning") ?? "") || null,
    campaignObjective: String(formData.get("campaignObjective") ?? "") || null,
    channels: String(formData.get("channels") ?? "") || null,
    budget: Number(formData.get("budget") ?? 0) || null,
    timeline: String(formData.get("timeline") ?? "") || null,
    creativeStrategy: String(formData.get("creativeStrategy") ?? "") || null,
    leadStrategy: String(formData.get("leadStrategy") ?? "") || null,
    conversionStrategy: String(formData.get("conversionStrategy") ?? "") || null,
    kpis: String(formData.get("kpis") ?? "") || null,
    successCriteria: String(formData.get("successCriteria") ?? "") || null,
    risks: String(formData.get("risks") ?? "") || null,
    assumptions: String(formData.get("assumptions") ?? "") || null
  };
  await prisma.strategy.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "strategy.update", { entityType: "Strategy", entityId: id, after: data });
}

async function createVersion(formData: FormData) {
  "use server";
  const session = await requireSession();
  const parentId = String(formData.get("parentId"));
  const changeReason = String(formData.get("changeReason") ?? "");
  const parent = await prisma.strategy.findFirst({ where: { id: parentId, orgId: session.orgId } });
  if (!parent) return;
  const next = await prisma.strategy.create({
    data: {
      orgId: parent.orgId,
      clientId: parent.clientId,
      title: parent.title,
      version: parent.version + 1,
      parentId: parent.id,
      businessObjective: parent.businessObjective,
      targetAudience: parent.targetAudience,
      market: parent.market,
      offer: parent.offer,
      positioning: parent.positioning,
      campaignObjective: parent.campaignObjective,
      channels: parent.channels,
      budget: parent.budget,
      timeline: parent.timeline,
      creativeStrategy: parent.creativeStrategy,
      leadStrategy: parent.leadStrategy,
      conversionStrategy: parent.conversionStrategy,
      kpis: parent.kpis,
      successCriteria: parent.successCriteria,
      risks: parent.risks,
      assumptions: parent.assumptions,
      status: "DRAFT",
      changeReason,
      authorId: session.userId
    }
  });
  await audit(session.orgId, session.userId, "strategy.new_version", {
    entityType: "Strategy",
    entityId: next.id,
    after: { fromVersion: parent.version, toVersion: next.version, changeReason }
  });
  redirect(`/app/strategy/${next.id}`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const s = await prisma.strategy.findFirst({ where: { id, orgId: session.orgId } });
  if (!s) return;
  await prisma.strategy.update({
    where: { id },
    data: {
      status: to,
      approverId: ["APPROVED"].includes(to) ? session.userId : s.approverId,
      approvedAt: ["APPROVED"].includes(to) ? new Date() : s.approvedAt
    }
  });
  await audit(session.orgId, session.userId, "strategy.status_change", { entityType: "Strategy", entityId: id, after: { status: to } });
}

export default async function StrategyDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const s = await prisma.strategy.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, author: true, approver: true }
  });
  if (!s) notFound();

  const transitions = nextStatesFor(s.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${s.title} - v${s.version}`}
        subtitle={`${s.client?.businessName ?? "Internal"} - Author: ${s.author.name} - ${fmtDate(s.createdAt)}`}
        breadcrumbs={[{ label: "Strategy", href: "/app/strategy" }, { label: `v${s.version}` }]}
        right={
          <>
            <StatusPill status={s.status} />
            {transitions.map((t) => (
              <form action={transition} key={t}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="to" value={t} />
                <button className="btn btn-secondary btn-sm">{STRATEGY_STATUS_LABELS[t as keyof typeof STRATEGY_STATUS_LABELS] ?? t}</button>
              </form>
            ))}
          </>
        }
      />

      {s.changeReason && (
        <div className="card p-4 bg-brand-50 border-brand-200 text-sm">
          <span className="font-semibold">Change reason:</span> {s.changeReason}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <form action={updateStrategy} className="card p-5 lg:col-span-2 space-y-4">
          <input type="hidden" name="id" value={s.id} />
          <Field label="Business objective" name="businessObjective" defaultValue={s.businessObjective ?? ""} />
          <Field label="Target audience" name="targetAudience" defaultValue={s.targetAudience ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Market" name="market" defaultValue={s.market ?? ""} />
            <Field label="Budget ()" name="budget" type="number" defaultValue={String(s.budget ?? "")} />
          </div>
          <Field label="Offer" name="offer" defaultValue={s.offer ?? ""} />
          <Field label="Positioning" name="positioning" defaultValue={s.positioning ?? ""} />
          <Field label="Campaign objective" name="campaignObjective" defaultValue={s.campaignObjective ?? ""} />
          <Field label="Channels (JSON or comma-separated)" name="channels" defaultValue={s.channels ?? ""} />
          <Field label="Timeline" name="timeline" defaultValue={s.timeline ?? ""} />
          <Field label="Creative strategy" name="creativeStrategy" defaultValue={s.creativeStrategy ?? ""} textarea />
          <Field label="Lead strategy" name="leadStrategy" defaultValue={s.leadStrategy ?? ""} textarea />
          <Field label="Conversion strategy" name="conversionStrategy" defaultValue={s.conversionStrategy ?? ""} textarea />
          <Field label="KPIs (JSON)" name="kpis" defaultValue={s.kpis ?? ""} />
          <Field label="Success criteria" name="successCriteria" defaultValue={s.successCriteria ?? ""} textarea />
          <Field label="Risks" name="risks" defaultValue={s.risks ?? ""} textarea />
          <Field label="Assumptions" name="assumptions" defaultValue={s.assumptions ?? ""} textarea />
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm">Save changes</button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Approval</h3>
            <div className="space-y-2 text-sm">
              <Row label="Status" value={<StatusPill status={s.status} />} />
              <Row label="Author" value={s.author.name} />
              <Row label="Approver" value={s.approver?.name ?? "-"} />
              <Row label="Approved at" value={fmtDate(s.approvedAt)} />
              <Row label="Version" value={`v${s.version}`} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Create new version</h3>
            <form action={createVersion} className="space-y-3">
              <input type="hidden" name="parentId" value={s.id} />
              <textarea
                name="changeReason"
                className="input"
                rows={3}
                placeholder="What changed and why?"
                required
              />
              <button className="btn btn-primary w-full">Create v{s.version + 1}</button>
              <p className="text-xs text-ink-500">
                New versions start as DRAFT and must be approved independently.
              </p>
            </form>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Why versioning?</h3>
            <p className="text-xs text-ink-600">
              Every strategy change is recorded with author, reason, and approval status. This
              becomes structured training data for the future Strategy Intelligence engine (Phase 2).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", textarea }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} className="input min-h-[80px]" rows={3} />
      ) : (
        <input type={type} name={name} defaultValue={defaultValue} className="input" />
      )}
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

function nextStatesFor(s: string): string[] {
  const map: Record<string, string[]> = {
    DRAFT: ["INTERNAL_REVIEW"],
    INTERNAL_REVIEW: ["CLIENT_APPROVAL", "DRAFT"],
    CLIENT_APPROVAL: ["APPROVED", "INTERNAL_REVIEW"],
    APPROVED: ["ARCHIVED"],
    ARCHIVED: []
  };
  return map[s] ?? [];
}