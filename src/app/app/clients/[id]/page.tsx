import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtNum, fmtPct, fmtDate, ctr, roas } from "@/lib/format";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      campaigns: { orderBy: { createdAt: "desc" } },
      leads: { orderBy: { createdAt: "desc" }, take: 8 },
      customers: { orderBy: { acquiredAt: "desc" } },
      strategies: { orderBy: { version: "desc" } },
      events: { orderBy: { startAt: "desc" } },
      reports: { orderBy: { createdAt: "desc" } },
      requests: { orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { createdAt: "desc" }, take: 8 },
      experiments: { orderBy: { createdAt: "desc" } },
      onboarding: true
    }
  });
  if (!client) notFound();

  const totalSpend = client.campaigns.reduce((s, c) => s + c.spent, 0);
  const totalRevenue = client.customers.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = client.leads.length;
  const totalCust = client.customers.length;
  const cpl_ = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const cac_ = totalCust > 0 ? totalSpend / totalCust : 0;
  const roas_ = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.businessName}
        subtitle={`${client.industry ?? "—"} · ${client.city ?? "—"}, ${client.country ?? "—"}`}
        breadcrumbs={[{ label: "Clients", href: "/app/clients" }, { label: client.businessName }]}
        right={
          <>
            <StatusPill status={client.status} />
            <Link href={`/app/clients/${client.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Kpi label="Spend" value={fmtINR(totalSpend)} />
        <Kpi label="Revenue" value={fmtINR(totalRevenue)} />
        <Kpi label="Leads" value={fmtNum(totalLeads)} />
        <Kpi label="CPL" value={fmtINR(cpl_)} />
        <Kpi label="CAC" value={fmtINR(cac_)} />
        <Kpi label="ROAS" value={`${roas_.toFixed(2)}x`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Campaigns ({client.campaigns.length})</h3>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Platform</th><th>Status</th><th>Spend</th><th>Leads</th><th>CPL</th></tr>
            </thead>
            <tbody>
              {client.campaigns.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/app/campaigns/${c.id}`} className="text-brand-600 hover:underline">{c.name}</Link></td>
                  <td>{c.platform}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td>{fmtINR(c.spent)}</td>
                  <td>{fmtNum(c.leads)}</td>
                  <td>{fmtINR(c.spent / Number(c.leads || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink-700">Account</h3>
          <Row label="Contact" value={`${client.contactName} · ${client.contactEmail}`} />
          <Row label="Phone" value={client.contactPhone ?? "—"} />
          <Row label="Website" value={client.websiteUrl ?? "—"} />
          <Row label="Tier" value={client.tier} />
          <Row label="Monthly budget" value={fmtINR(client.monthlyBudget ?? 0)} />
          <Row label="Contract" value={`${fmtDate(client.contractStart)} → ${fmtDate(client.contractEnd)}`} />
          <Row label="Status" value={client.status} />
          {client.notes && (
            <div className="pt-2 border-t border-ink-100">
              <div className="text-xs text-ink-500 font-semibold mb-1">Notes</div>
              <div className="text-sm">{client.notes}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-700">Strategy versions</h3>
            <Link href="/app/strategy" className="text-xs text-brand-600 hover:underline">Strategy module →</Link>
          </div>
          {client.strategies.length === 0 && <p className="text-sm text-ink-500">No strategies yet.</p>}
          <ul className="divide-y divide-ink-100">
            {client.strategies.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">v{s.version} · {s.title}</div>
                  <div className="text-xs text-ink-500">{s.changeReason ?? "—"} · {fmtDate(s.createdAt)}</div>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent leads</h3>
          <ul className="divide-y divide-ink-100">
            {client.leads.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{l.name ?? l.email ?? "Lead"}</div>
                  <div className="text-xs text-ink-500">{l.source} · {l.city ?? "—"}</div>
                </div>
                <StatusPill status={l.status} />
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-ink-100">
            <Link href={`/app/leads?clientId=${client.id}`} className="text-xs text-brand-600 hover:underline">All leads →</Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Events" link="/app/events" items={client.events.map((e) => ({ title: e.name, sub: `${e.type} · ${fmtDate(e.startAt)}`, status: e.status }))} />
        <Card title="Reports" link="/app/reports" items={client.reports.map((r) => ({ title: r.title, sub: `${fmtDate(r.periodStart)} → ${fmtDate(r.periodEnd)}`, status: r.status }))} />
        <Card title="Requests" link="/app/requests" items={client.requests.map((r) => ({ title: r.title, sub: `${r.category} · ${r.priority}`, status: r.status }))} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent decisions</h3>
        {client.decisions.length === 0 && <p className="text-sm text-ink-500">No decisions logged.</p>}
        <ul className="space-y-2">
          {client.decisions.map((d) => (
            <li key={d.id} className="text-sm border-l-2 border-brand-300 pl-3">
              <div className="font-medium">{d.decisionType.replace(/_/g, " ")} — {d.decision}</div>
              <div className="text-xs text-ink-500">{d.reason}</div>
              {d.expectedOutcome && (
                <div className="text-xs mt-1">
                  <span className="text-ink-500">Expected:</span> {d.expectedOutcome}{" "}
                  {d.actualOutcome && <><span className="text-ink-500">· Actual:</span> {d.actualOutcome}</>}
                </div>
              )}
            </li>
          ))}
        </ul>
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
function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <div className="text-ink-500">{label}</div>
      <div className="font-medium text-right">{value}</div>
    </div>
  );
}
function Card({ title, items, link }: { title: string; items: any[]; link: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-700">{title}</h3>
        <Link href={link} className="text-xs text-brand-600 hover:underline">All →</Link>
      </div>
      {items.length === 0 && <p className="text-sm text-ink-500">None yet.</p>}
      <ul className="divide-y divide-ink-100">
        {items.map((it, i) => (
          <li key={i} className="py-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium truncate">{it.title}</div>
              <div className="text-xs text-ink-500 truncate">{it.sub}</div>
            </div>
            <StatusPill status={it.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}