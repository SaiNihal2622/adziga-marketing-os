import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_LIFECYCLE_ORDER } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function updateLead(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const l = await prisma.lead.findFirst({ where: { id, orgId: session.orgId } });
  if (!l) return;
  const status = String(formData.get("status"));
  const data: any = {
    status,
    score: Number(formData.get("score") ?? 0),
    qualificationData: String(formData.get("qualificationData") ?? "") || null,
    lastContactAt: ["CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(status) ? new Date() : l.lastContactAt,
    wonAt: status === "WON" ? new Date() : l.wonAt,
    lostAt: status === "LOST" ? new Date() : l.lostAt
  };
  if (status === "WON") {
    data.revenue = Number(formData.get("revenue") ?? 0) || 0;
    // create customer
    const existing = await prisma.customer.findFirst({ where: { leadId: id } });
    if (!existing) {
      await prisma.customer.create({
        data: {
          orgId: l.orgId,
          clientId: l.clientId,
          leadId: l.id,
          name: l.name ?? "Customer",
          email: l.email,
          phone: l.phone,
          revenue: data.revenue,
          acquiredAt: new Date()
        }
      });
    }
  }
  await prisma.lead.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "lead.update", { entityType: "Lead", entityId: id, after: data });
  redirect(`/app/leads/${id}`);
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const l = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, campaign: true, influencer: true, event: true, customer: true }
  });
  if (!l) notFound();

  const followUps = l.followUps ? JSON.parse(l.followUps) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={l.name ?? l.email ?? "Lead"}
        subtitle={`${l.source} - ${l.city ?? "-"} - Score ${l.score}`}
        breadcrumbs={[{ label: "Leads", href: "/app/leads" }, { label: l.name ?? l.email ?? l.id }]}
        right={<StatusPill status={l.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <form action={updateLead} className="card p-5 lg:col-span-2 space-y-4">
          <input type="hidden" name="id" value={l.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={l.status} className="input">
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Score (0-100)</label>
              <input type="number" name="score" defaultValue={l.score} min={0} max={100} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Qualification data</label>
            <textarea
              name="qualificationData"
              defaultValue={l.qualificationData ?? ""}
              rows={3}
              className="input"
              placeholder='{"budget": "2Cr+", "timeline": "0-3 months", "decision_maker": true}'
            />
          </div>
          {l.status === "WON" && (
            <div>
              <label className="label">Revenue ()</label>
              <input type="number" name="revenue" defaultValue={l.revenue} className="input" />
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm">Save</button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Contact</h3>
            <Row label="Email" value={l.email ?? "-"} />
            <Row label="Phone" value={l.phone ?? "-"} />
            <Row label="City" value={l.city ?? "-"} />
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Attribution</h3>
            <Row label="Source" value={l.source} />
            <Row label="Campaign" value={l.campaign ? <Link href={`/app/campaigns/${l.campaign.id}`} className="text-brand-600 hover:underline">{l.campaign.name}</Link> : "-"} />
            <Row label="Influencer" value={l.influencer ? <Link href={`/app/influencers/${l.influencer.id}`} className="text-brand-600 hover:underline">{l.influencer.name}</Link> : "-"} />
            <Row label="Event" value={l.event ? <Link href={`/app/events/${l.event.id}`} className="text-brand-600 hover:underline">{l.event.name}</Link> : "-"} />
            <Row label="Landing page" value={l.landingPage ?? "-"} />
            <Row label="Click ID" value={l.clickId ?? "-"} />
            <Row label="UTM Source/Medium" value={`${l.utmSource ?? "-"}/${l.utmMedium ?? "-"}`} />
          </div>
        </div>
      </div>

      {/* Lifecycle progress */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Lifecycle position</h3>
        <div className="grid grid-cols-6 gap-2">
          {LEAD_LIFECYCLE_ORDER.map((s, i) => {
            const reached = LEAD_LIFECYCLE_ORDER.indexOf(l.status as any) >= i || l.status === "WON" || l.status === "LOST";
            const current = l.status === s;
            return (
              <div key={s} className={`p-3 rounded-lg text-center ${current ? "bg-brand-600 text-white" : reached ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-500"}`}>
                <div className="text-[10px]">Step {i + 1}</div>
                <div className="font-medium text-xs mt-1">{LEAD_STATUS_LABELS[s]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Kpi label="Won revenue" value={fmtINR(l.revenue)} />
        <Kpi label="Last contact" value={l.lastContactAt ? relTime(l.lastContactAt) : "-"} />
        <Kpi label="Customer" value={l.customer ? <Link href={`/app/clients/${l.clientId}`} className="text-brand-600 hover:underline">View </Link> : "Not yet"} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Follow-ups</h3>
        {followUps.length === 0 ? <p className="text-sm text-ink-500">No follow-ups recorded. (Phase 2: AI-suggested follow-ups with approval.)</p> :
          <ul className="divide-y divide-ink-100">
            {followUps.map((f: any, i: number) => (
              <li key={i} className="py-2 text-sm">{f.note ?? JSON.stringify(f)}</li>
            ))}
          </ul>
        }
      </div>
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <div className="flex items-start justify-between text-sm py-1.5 gap-3">
      <div className="text-ink-500">{label}</div>
      <div className="font-medium text-right truncate">{value}</div>
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-4">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value text-lg">{value}</div>
    </div>
  );
}