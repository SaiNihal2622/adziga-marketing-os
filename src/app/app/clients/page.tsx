import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate } from "@/lib/format";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireSession();
  const clients = await prisma.client.findMany({
    where: { orgId: session.orgId },
    include: {
      campaigns: true,
      leads: true,
      customers: true,
      _count: { select: { campaigns: true, leads: true, customers: true, requests: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Each client account owns its own strategy, campaigns, leads, creatives, and reports."
        right={
          <Link href="/app/clients/new" className="btn btn-primary btn-sm">+ Add client</Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => {
          const totalSpend = c.campaigns.reduce((s, x) => s + x.spent, 0);
          const totalRevenue = c.customers.reduce((s, x) => s + x.revenue, 0);
          const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
          return (
            <Link
              key={c.id}
              href={`/app/clients/${c.id}`}
              className="card p-5 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-lg">{c.businessName}</div>
                  <div className="text-sm text-ink-500">{c.industry} · {c.city}</div>
                </div>
                <StatusPill status={c.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Spend" value={fmtINR(totalSpend)} />
                <Stat label="Revenue" value={fmtINR(totalRevenue)} />
                <Stat label="Leads" value={fmtNum(c._count.leads)} />
                <Stat label="Customers" value={fmtNum(c._count.customers)} />
                <Stat label="Campaigns" value={fmtNum(c._count.campaigns)} />
                <Stat label="ROAS" value={`${roas.toFixed(2)}x`} />
              </div>
              <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between text-xs">
                <span className="text-ink-500">Tier: <span className="font-medium">{c.tier}</span></span>
                <span className="text-ink-500">Since {fmtDate(c.contractStart ?? c.createdAt)}</span>
              </div>
            </Link>
          );
        })}
        {clients.length === 0 && (
          <div className="card p-10 text-center text-ink-500 col-span-full">
            No clients yet. Click "+ Add client" to create your first.
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">All clients</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Industry</th>
              <th>Status</th>
              <th>Tier</th>
              <th>Contact</th>
              <th>Active campaigns</th>
              <th>Monthly budget</th>
              <th>Contract</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/app/clients/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.businessName}</Link></td>
                <td>{c.industry ?? "—"}</td>
                <td><StatusPill status={c.status} /></td>
                <td>{c.tier}</td>
                <td>{c.contactName}<div className="text-xs text-ink-500">{c.contactEmail}</div></td>
                <td>{c._count.campaigns}</td>
                <td>{fmtINR(c.monthlyBudget ?? 0)}</td>
                <td className="text-xs">{fmtDate(c.contractStart)} → {fmtDate(c.contractEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}