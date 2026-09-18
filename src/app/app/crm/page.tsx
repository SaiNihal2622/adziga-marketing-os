import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate, relTime } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_LIFECYCLE_ORDER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CRMPage({ searchParams }: { searchParams: { clientId?: string } }) {
  const session = await requireSession();
  const where: any = { orgId: session.orgId };
  if (searchParams.clientId) where.clientId = searchParams.clientId;

  const [customers, leadsActive, clients] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { client: true, lead: { include: { campaign: true } } },
      orderBy: { acquiredAt: "desc" }
    }),
    prisma.lead.findMany({
      where: { orgId: session.orgId, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL"] } },
      include: { client: true, campaign: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  const totalRev = customers.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        subtitle="Active deals and converted customers. Each customer retains the originating lead and full attribution."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Customers" value={fmtNum(customers.length)} />
        <Kpi label="Total revenue" value={fmtINR(totalRev)} />
        <Kpi label="Avg deal size" value={fmtINR(customers.length ? totalRev / customers.length : 0)} />
        <Kpi label="Active deals" value={fmtNum(leadsActive.length)} />
      </div>

      <div className="card p-4 flex flex-wrap gap-2 text-xs">
        <span className="text-ink-500">Client:</span>
        <Link href="/app/crm" className={`badge ${!searchParams.clientId ? "badge-brand" : "badge-neutral"}`}>All</Link>
        {clients.map((c) => (
          <Link key={c.id} href={`/app/crm?clientId=${c.id}`} className={`badge ${searchParams.clientId === c.id ? "badge-brand" : "badge-neutral"}`}>{c.businessName}</Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Active pipeline</h3>
          <ul className="divide-y divide-ink-100">
            {leadsActive.slice(0, 20).map((l) => (
              <li key={l.id} className="py-2">
                <Link href={`/app/leads/${l.id}`} className="flex items-center justify-between gap-2 hover:bg-ink-50 -mx-2 px-2 rounded">
                  <div>
                    <div className="text-sm font-medium">{l.name ?? l.email}</div>
                    <div className="text-xs text-ink-500">{l.client?.businessName} - {l.source}</div>
                  </div>
                  <StatusPill status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-ink-100"><Link href="/app/leads" className="text-xs text-brand-600 hover:underline">All leads </Link></div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Customers</h3>
          <ul className="divide-y divide-ink-100">
            {customers.slice(0, 20).map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-ink-500">{c.client.businessName} - acquired {fmtDate(c.acquiredAt)}</div>
                </div>
                <div className="text-sm font-mono font-medium">{fmtINR(c.revenue)}</div>
              </li>
            ))}
          </ul>
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