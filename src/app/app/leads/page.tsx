import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_LIFECYCLE_ORDER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: { clientId?: string; status?: string; source?: string; q?: string } }) {
  const session = await requireSession();
  const where: any = { orgId: session.orgId };
  if (searchParams.clientId) where.clientId = searchParams.clientId;
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.source) where.source = searchParams.source;
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q } },
      { email: { contains: searchParams.q } },
      { phone: { contains: searchParams.q } },
      { city: { contains: searchParams.q } }
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { client: true, campaign: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  // Pipeline counts
  const pipeline = LEAD_LIFECYCLE_ORDER.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status],
    count: leads.filter((l) => l.status === status).length
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & CRM"
        subtitle="Every lead moves through: New → Contacted → Qualified → Meeting → Proposal → Won/Lost. Full attribution is preserved."
        right={
          <Link href="/app/leads/new" className="btn btn-primary btn-sm">+ New lead</Link>
        }
      />

      {/* Lifecycle pipeline */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Pipeline (current view)</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {pipeline.map((s) => (
            <Link
              key={s.status}
              href={`/app/leads?status=${s.status}`}
              className="card p-3 border-ink-200 text-center hover:bg-ink-50"
            >
              <div className="text-2xl font-bold">{fmtNum(s.count)}</div>
              <div className="text-xs text-ink-500 mt-1">{s.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <form className="flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search name / email / phone / city"
            className="input w-72"
          />
          <select name="status" defaultValue={searchParams.status ?? ""} className="input w-44">
            <option value="">All statuses</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="source" defaultValue={searchParams.source ?? ""} className="input w-44">
            <option value="">All sources</option>
            <option value="META_AD">Meta Ad</option>
            <option value="GOOGLE_AD">Google Ad</option>
            <option value="INFLUENCER">Influencer</option>
            <option value="EVENT">Event</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="ORGANIC">Organic</option>
            <option value="DIRECT">Direct</option>
          </select>
          <button className="btn btn-secondary btn-sm">Filter</button>
          <Link href="/app/leads" className="text-xs text-ink-500 hover:underline">Reset</Link>
        </form>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-ink-500 mr-2">Client:</span>
          <Link href="/app/leads" className={`badge ${!searchParams.clientId ? "badge-brand" : "badge-neutral"}`}>All</Link>
          {clients.map((c) => (
            <Link key={c.id} href={`/app/leads?clientId=${c.id}`} className={`badge ${searchParams.clientId === c.id ? "badge-brand" : "badge-neutral"}`}>{c.businessName}</Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Source</th>
              <th>Campaign</th>
              <th>Client</th>
              <th>City</th>
              <th>Status</th>
              <th>Score</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/app/leads/${l.id}`} className="font-medium text-brand-600 hover:underline">{l.name ?? l.email ?? "—"}</Link></td>
                <td className="text-xs">
                  <div>{l.email}</div>
                  <div className="text-ink-500">{l.phone}</div>
                </td>
                <td><span className="badge badge-neutral">{l.source}</span></td>
                <td className="text-xs">{l.campaign?.name ?? "—"}</td>
                <td className="text-xs">{l.client?.businessName ?? "—"}</td>
                <td className="text-xs">{l.city ?? "—"}</td>
                <td><StatusPill status={l.status} /></td>
                <td className="text-xs font-mono">{l.score}</td>
                <td className="text-xs">{relTime(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}