// Adziga — /app/clients/[id]
// Polished detail view: KPIs across the funnel, campaigns table, account
// metadata, strategy / leads / events / reports snapshots.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader, StatRow } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtDate, fmtRelative, creativePreferenceLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      campaigns: { orderBy: { createdAt: "desc" }, take: 20 },
      leads: { orderBy: { createdAt: "desc" }, take: 8 },
      customers: { orderBy: { acquiredAt: "desc" } },
      strategies: { orderBy: { version: "desc" }, take: 5 },
      events: { orderBy: { startAt: "desc" }, take: 5 },
      reports: { orderBy: { createdAt: "desc" }, take: 5 },
      requests: { orderBy: { createdAt: "desc" }, take: 5 },
      decisions: { orderBy: { createdAt: "desc" }, take: 8 },
      experiments: { orderBy: { createdAt: "desc" }, take: 5 },
      onboarding: true,
      briefs: { orderBy: { createdAt: "desc" }, take: 10 }
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
  const openBriefs = client.briefs.filter((b) => !["DELIVERED", "ARCHIVED"].includes(b.status)).length;

  return (
    <div>
      <PageHeader
        eyebrow={client.industry ?? "Brand"}
        title={client.businessName}
        subtitle={`${client.city ?? "—"}${client.country ? ", " + client.country : ""} · Tier ${client.tier} · ${creativePreferenceLabel(client.creativePreference)} creatives`}
        breadcrumbs={[{ label: "Clients", href: "/app/clients" }, { label: client.businessName }]}
        right={
          <>
            <ClientStatusBadge status={client.status} />
            <Link href={`/app/clients/${client.id}/command-center`}>
              <Button variant="primary">Command Center</Button>
            </Link>
            <Link href={`/app/ai?clientId=${client.id}`}>
              <Button variant="outline">AI workspace</Button>
            </Link>
            <Link href={`/app/clients/${client.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Kpi label="Spend" value={fmtINR(totalSpend)} hint="lifetime" />
        <Kpi label="Revenue" value={fmtINR(totalRevenue)} tone="brand" />
        <Kpi label="Leads" value={fmtNum(totalLeads)} hint={`${fmtINR(cpl_)} CPL`} />
        <Kpi label="Customers" value={fmtNum(totalCust)} hint={`${fmtINR(cac_)} CAC`} />
        <Kpi label="ROAS" value={`${roas_.toFixed(2)}×`} tone={roas_ >= 2 ? "success" : "neutral"} />
        <Kpi label="Open briefs" value={String(openBriefs)} tone={openBriefs > 0 ? "accent" : "neutral"} hint="designer work" />
      </div>

      {/* Campaigns + Account side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-8">
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Campaigns</h3>
              <p className="text-xs text-ink-500 mt-0.5">{client.campaigns.length} total</p>
            </div>
            <Link href={`/app/campaigns?clientId=${client.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              View all →
            </Link>
          </div>
          {client.campaigns.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-500">No campaigns yet — open the AI workspace to plan one.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Platform</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Spend</th>
                  <th className="px-5 py-2.5 text-right">Leads</th>
                  <th className="px-5 py-2.5 text-right">CPL</th>
                </tr>
              </thead>
              <tbody>
                {client.campaigns.map((c) => {
                  const cpl = Number(c.leads) > 0 ? c.spent / Number(c.leads) : 0;
                  return (
                    <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/40 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/app/campaigns/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-700"><Badge variant="neutral">{c.platform}</Badge></td>
                      <td className="px-5 py-3"><CampaignStatusBadge status={c.status} /></td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtINR(c.spent)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtNum(c.leads)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtINR(cpl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card padding="lg">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 mb-3">Account</h3>
          <StatRow label="Contact" value={client.contactName} hint={client.contactEmail} />
          <StatRow label="Phone" value={client.contactPhone ?? "—"} />
          {client.websiteUrl && <StatRow label="Website" value={<a href={client.websiteUrl} target="_blank" rel="noopener" className="text-brand-600 hover:underline text-xs">{client.websiteUrl}</a>} />}
          <StatRow label="Tier" value={<Badge variant="brand">{client.tier}</Badge>} />
          <StatRow label="Monthly budget" value={fmtINR(client.monthlyBudget ?? 0)} />
          <StatRow label="Creative preference" value={<Badge variant="neutral">{creativePreferenceLabel(client.creativePreference)}</Badge>} />
          <StatRow label="Contract" value={`${fmtDate(client.contractStart)} → ${fmtDate(client.contractEnd)}`} />
          {client.notes && (
            <div className="mt-4 pt-3 border-t border-ink-100">
              <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Notes</div>
              <p className="text-sm text-ink-700 leading-relaxed">{client.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Strategy + Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Strategy</h3>
            <p className="text-xs text-ink-500 mt-0.5">Recent versions and approvals</p>
          </div>
          {client.strategies.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No strategy recorded yet.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {client.strategies.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">v{s.version} — {s.title}</div>
                    <div className="text-xs text-ink-500 truncate mt-0.5">{s.changeReason ?? "—"} · {fmtRelative(s.createdAt)}</div>
                  </div>
                  <Badge variant={s.status === "APPROVED" ? "success" : s.status === "DRAFT" ? "neutral" : "warning"} dot>
                    {s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Recent leads</h3>
              <p className="text-xs text-ink-500 mt-0.5">Last 8 captured</p>
            </div>
            <Link href={`/app/leads?clientId=${client.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">All leads →</Link>
          </div>
          {client.leads.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No leads captured yet.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {client.leads.map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">{l.name ?? l.email ?? "Lead"}</div>
                    <div className="text-xs text-ink-500 truncate mt-0.5">{l.source ?? "—"} · {l.city ?? "—"}</div>
                  </div>
                  <Badge variant={l.status === "CONVERTED" ? "success" : l.status === "QUALIFIED" ? "brand" : "neutral"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Briefs + Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Designer briefs</h3>
              <p className="text-xs text-ink-500 mt-0.5">{client.briefs.length} total · {openBriefs} open</p>
            </div>
            <Link href={`/app/studio?clientId=${client.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Studio →</Link>
          </div>
          {client.briefs.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No briefs opened yet. The Content Agent creates one when creativePreference is AI_DESIGNER or MANUAL_ONLY.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {client.briefs.map((b) => (
                <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">{b.title}</div>
                    <div className="text-xs text-ink-500 truncate mt-0.5">{b.format} · {b.platform} · {fmtRelative(b.createdAt)}</div>
                  </div>
                  <Badge variant={b.status === "DELIVERED" ? "success" : b.status === "IN_PROGRESS" ? "info" : b.status === "OPEN" ? "warning" : "neutral"} dot>
                    {b.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Recent decisions</h3>
            <p className="text-xs text-ink-500 mt-0.5">Strategy + agent decisions logged for this client</p>
          </div>
          {client.decisions.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500 text-center">No decisions logged yet.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {client.decisions.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="text-sm font-medium text-ink-900">{d.decisionType.replace(/_/g, " ")}</div>
                    <span className="text-xs text-ink-400">{fmtRelative(d.createdAt)}</span>
                  </div>
                  <div className="text-sm text-ink-700 leading-relaxed">{d.decision}</div>
                  {d.reason && <div className="text-xs text-ink-500 mt-1.5">↳ {d.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Events + Reports + Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Snapshot title="Events" link="/app/events" empty="No events scheduled." items={client.events.map((e) => ({ title: e.name, sub: `${e.type} · ${fmtDate(e.startAt)}`, status: e.status }))} />
        <Snapshot title="Reports" link="/app/reports" empty="No reports published." items={client.reports.map((r) => ({ title: r.title, sub: `${fmtDate(r.periodStart)} → ${fmtDate(r.periodEnd)}`, status: r.status }))} />
        <Snapshot title="Requests" link="/app/requests" empty="No client requests." items={client.requests.map((r) => ({ title: r.title, sub: `${r.category} · ${r.priority}`, status: r.status }))} />
      </div>
    </div>
  );
}

function Snapshot({ title, items, link, empty }: { title: string; items: Array<{ title: string; sub: string; status: string }>; link: string; empty: string }) {
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
        <Link href={link} className="text-xs text-brand-600 hover:text-brand-700 font-medium">All →</Link>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-ink-500 text-center">{empty}</div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((it, i) => (
            <li key={i} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900 truncate">{it.title}</div>
                <div className="text-xs text-ink-500 truncate mt-0.5">{it.sub}</div>
              </div>
              <Badge variant="neutral">{it.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ClientStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    ACTIVE: { variant: "success", label: "Active" },
    ONBOARDING: { variant: "info", label: "Onboarding" },
    PAUSED: { variant: "warning", label: "Paused" },
    CHURNED: { variant: "neutral", label: "Churned" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    DRAFT: { variant: "neutral", label: "Draft" },
    INTERNAL_REVIEW: { variant: "info", label: "Internal review" },
    CLIENT_APPROVAL: { variant: "info", label: "Client approval" },
    READY: { variant: "info", label: "Ready" },
    ACTIVE: { variant: "success", label: "Active" },
    PAUSED: { variant: "warning", label: "Paused" },
    COMPLETED: { variant: "brand", label: "Completed" },
    ARCHIVED: { variant: "neutral", label: "Archived" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
