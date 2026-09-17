import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtDateTime, fmtINR, fmtNum } from "@/lib/format";
import { EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function addRegistration(formData: FormData) {
  "use server";
  const session = await requireSession();
  const eventId = String(formData.get("eventId"));
  const e = await prisma.marketingEvent.findFirst({ where: { id: eventId, orgId: session.orgId } });
  if (!e) return;
  await prisma.registration.create({
    data: {
      eventId,
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      source: String(formData.get("source") ?? "") || null,
      utmSource: String(formData.get("utmSource") ?? "") || null
    }
  });
  await prisma.marketingEvent.update({
    where: { id: eventId },
    data: { registrations: { increment: 1 } }
  });
  await audit(session.orgId, session.userId, "event.registration.create", { entityType: "Registration", entityId: eventId });
  redirect(`/app/events/${eventId}`);
}

async function updateFunnel(formData: FormData) {
  "use server";
  const session = await requireSession();
  const eventId = String(formData.get("eventId"));
  const e = await prisma.marketingEvent.findFirst({ where: { id: eventId, orgId: session.orgId } });
  if (!e) return;
  await prisma.marketingEvent.update({
    where: { id: eventId },
    data: {
      registrations: Number(formData.get("registrations") ?? e.registrations),
      attended: Number(formData.get("attended") ?? e.attended),
      qualified: Number(formData.get("qualified") ?? e.qualified),
      consultations: Number(formData.get("consultations") ?? e.consultations),
      conversions: Number(formData.get("conversions") ?? e.conversions),
      revenue: Number(formData.get("revenue") ?? e.revenue)
    }
  });
  redirect(`/app/events/${eventId}`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  await prisma.marketingEvent.update({ where: { id }, data: { status: to } });
  await audit(session.orgId, session.userId, "event.status_change", { entityType: "MarketingEvent", entityId: id, after: { status: to } });
}

export default async function EventDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const e = await prisma.marketingEvent.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, registrations2: { orderBy: { createdAt: "desc" } } }
  });
  if (!e) notFound();

  const transitions = ["PLANNED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "LIVE", "COMPLETED", "CANCELLED"].filter((s) => s !== e.status);
  void transitions;

  return (
    <div className="space-y-6">
      <PageHeader
        title={e.name}
        subtitle={`${EVENT_TYPE_LABELS[e.type as keyof typeof EVENT_TYPE_LABELS]} · ${e.isOnline ? "Online" : e.city}`}
        breadcrumbs={[{ label: "Events", href: "/app/events" }, { label: e.name }]}
        right={
          <>
            <StatusPill status={e.status} />
          </>
        }
      />

      {/* Status transition buttons */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Lifecycle</h3>
        <div className="flex flex-wrap gap-2">
          {transitions.map((s) => (
            <form action={transition} key={s}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="to" value={s} />
              <button className="btn btn-secondary btn-sm">{EVENT_STATUS_LABELS[s as keyof typeof EVENT_STATUS_LABELS] ?? s}</button>
            </form>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Kpi label="Registrations" value={fmtNum(e.registrations)} />
        <Kpi label="Attended" value={fmtNum(e.attended)} />
        <Kpi label="Qualified" value={fmtNum(e.qualified)} />
        <Kpi label="Consultations" value={fmtNum(e.consultations)} />
        <Kpi label="Conversions" value={fmtNum(e.conversions)} />
        <Kpi label="Revenue" value={fmtINR(e.revenue)} />
      </div>

      {/* Funnel edit */}
      <form action={updateFunnel} className="card p-5">
        <input type="hidden" name="eventId" value={e.id} />
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Funnel — record actuals</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <NumField label="Registrations" name="registrations" value={e.registrations} />
          <NumField label="Attended" name="attended" value={e.attended} />
          <NumField label="Qualified" name="qualified" value={e.qualified} />
          <NumField label="Consultations" name="consultations" value={e.consultations} />
          <NumField label="Conversions" name="conversions" value={e.conversions} />
          <NumField label="Revenue (₹)" name="revenue" value={e.revenue} />
        </div>
        <div className="mt-3 flex justify-end"><button className="btn btn-primary btn-sm">Save</button></div>
      </form>

      {/* Registration entry */}
      <form action={addRegistration} className="card p-5 grid md:grid-cols-3 gap-3">
        <input type="hidden" name="eventId" value={e.id} />
        <div className="md:col-span-3 text-sm font-semibold text-ink-700">Add registration</div>
        <div>
          <label className="label">Name *</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="input" />
        </div>
        <div>
          <label className="label">Source</label>
          <input name="source" className="input" placeholder="meta_ad" />
        </div>
        <div>
          <label className="label">UTM Source</label>
          <input name="utmSource" className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Add registration</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">Registrations ({e.registrations2.length})</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {e.registrations2.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email ?? "—"}</td>
                <td>{r.phone ?? "—"}</td>
                <td><span className="badge badge-neutral">{r.source ?? "—"}</span></td>
                <td>
                  {r.attended && <span className="badge badge-success">Attended</span>}
                  {r.qualified && <span className="badge badge-brand ml-1">Qualified</span>}
                  {r.consultBooked && <span className="badge badge-warning ml-1">Consult</span>}
                  {r.converted && <span className="badge badge-success ml-1">Converted</span>}
                </td>
                <td className="text-xs">{fmtDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="kpi-label">{label}</div><div className="kpi-value text-lg">{value}</div></div>;
}
function NumField({ label, name, value }: { label: string; name: string; value: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" name={name} defaultValue={value} className="input" />
    </div>
  );
}