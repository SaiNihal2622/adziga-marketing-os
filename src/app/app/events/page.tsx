import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate, fmtDateTime } from "@/lib/format";
import { EVENT_TYPE_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createEvent(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const e = await prisma.marketingEvent.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? "") || undefined,
      name,
      type: String(formData.get("type") ?? "WEBINAR"),
      city: String(formData.get("city") ?? "") || null,
      venue: String(formData.get("venue") ?? "") || null,
      isOnline: formData.get("isOnline") === "on",
      startAt: new Date(String(formData.get("startAt"))),
      endAt: formData.get("endAt") ? new Date(String(formData.get("endAt"))) : null,
      capacity: Number(formData.get("capacity") ?? 0) || null,
      registrationLimit: Number(formData.get("registrationLimit") ?? 0) || null,
      status: "PLANNED"
    }
  });
  await audit(session.orgId, session.userId, "event.create", { entityType: "MarketingEvent", entityId: e.id, after: { name } });
  redirect(`/app/events/${e.id}`);
}

export default async function EventsPage() {
  const session = await requireSession();
  const events = await prisma.marketingEvent.findMany({
    where: { orgId: session.orgId },
    include: { client: true, registrations2: true, _count: { select: { registrations2: true } } },
    orderBy: { startAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Online + offline marketing events with full funnel: Promotion → Application → Qualification → Approval → Registration → Attendance → Consultation → Conversion."
      />

      {/* New event form */}
      <form action={createEvent} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="label">Event name</label>
          <input name="name" required className="input" placeholder="Dubai Investor Briefing — Mumbai" />
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="input">
            <option value="">— Internal —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select name="type" className="input">
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isOnline" />
            <span>Online event</span>
          </label>
        </div>
        <div>
          <label className="label">City</label>
          <input name="city" className="input" placeholder="Mumbai" />
        </div>
        <div>
          <label className="label">Venue</label>
          <input name="venue" className="input" placeholder="Trident, Nariman Point" />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input name="capacity" type="number" className="input" />
        </div>
        <div>
          <label className="label">Start at</label>
          <input name="startAt" type="datetime-local" required className="input" />
        </div>
        <div>
          <label className="label">End at</label>
          <input name="endAt" type="datetime-local" className="input" />
        </div>
        <div>
          <label className="label">Registration limit</label>
          <input name="registrationLimit" type="number" className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Create event</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((e) => (
          <Link href={`/app/events/${e.id}`} key={e.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-ink-500">{EVENT_TYPE_LABELS[e.type as keyof typeof EVENT_TYPE_LABELS] ?? e.type}</div>
                <div className="font-semibold mt-1">{e.name}</div>
              </div>
              <StatusPill status={e.status} />
            </div>
            <div className="text-xs text-ink-500 mt-2">
              {e.isOnline ? "🌐 Online" : `📍 ${e.city ?? "—"} · ${e.venue ?? ""}`}
            </div>
            <div className="text-xs text-ink-500 mt-1">{fmtDateTime(e.startAt)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><div className="font-bold text-ink-900 text-sm">{fmtNum(e.registrations)}</div>Registrations</div>
              <div><div className="font-bold text-ink-900 text-sm">{fmtNum(e.qualified)}</div>Qualified</div>
              <div><div className="font-bold text-ink-900 text-sm">{fmtNum(e.conversions)}</div>Conversions</div>
            </div>
            {e.client && <div className="text-xs text-ink-500 mt-3">For: {e.client.businessName}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}