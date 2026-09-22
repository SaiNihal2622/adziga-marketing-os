// Adziga — /app/clients
// Polished list view with KPIs, filters, and a hover-elevated card grid
// followed by a sortable table. Editorial layout — clear hierarchy, generous
// whitespace, no decorative noise.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, EmptyState, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtDate, fmtRelative, creativePreferenceLabel } from "@/lib/format";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams
}: {
  searchParams: { status?: string; q?: string };
}) {
  const session = await requireSession();
  const filterStatus = searchParams.status;
  const q = searchParams.q?.toLowerCase().trim();

  const where: any = { orgId: session.orgId };
  if (filterStatus) where.status = filterStatus;
  if (q) where.businessName = { contains: q, mode: "insensitive" };

  const clients = await prisma.client.findMany({
    where,
    include: {
      campaigns: { select: { spent: true, revenue: true } },
      leads: { select: { id: true } },
      customers: { select: { id: true, revenue: true } },
      briefs: { select: { id: true, status: true } },
      _count: { select: { campaigns: true, leads: true, customers: true, requests: true, briefs: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // KPIs across the filtered scope
  const totalSpend = clients.reduce((s, c) => s + c.campaigns.reduce((ss, x) => ss + x.spent, 0), 0);
  const totalRevenue = clients.reduce((s, c) => s + c.customers.reduce((ss, x) => ss + x.revenue, 0), 0);
  const totalLeads = clients.reduce((s, c) => s + c.leads.length, 0);
  const openBriefs = clients.reduce(
    (s, c) => s + c.briefs.filter((b) => !["DELIVERED", "ARCHIVED"].includes(b.status)).length,
    0
  );
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const filters: Array<{ key?: string; label: string; href: string; count?: number }> = [
    { label: "All", href: "/app/clients", count: clients.length },
    { key: "ACTIVE", label: "Active", href: "/app/clients?status=ACTIVE" },
    { key: "ONBOARDING", label: "Onboarding", href: "/app/clients?status=ONBOARDING" },
    { key: "PAUSED", label: "Paused", href: "/app/clients?status=PAUSED" },
    { key: "CHURNED", label: "Churned", href: "/app/clients?status=CHURNED" }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Clients"
        subtitle="Each client account owns its own strategy, campaigns, leads, creatives, briefs, and reports."
        breadcrumbs={[{ label: "Clients" }]}
        right={
          <Link href="/app/clients/new">
            <Button>+ New client</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Clients" value={clients.length.toString()} hint={`${clients.filter((c) => c.status === "ACTIVE").length} active`} />
        <Kpi label="Total spend" value={fmtINR(totalSpend)} tone="brand" hint="lifetime" />
        <Kpi label="Pipeline" value={`${fmtNum(totalLeads)} leads`} tone="accent" hint={`${openBriefs} open briefs`} />
        <Kpi
          label="ROAS"
          value={`${roas.toFixed(2)}×`}
          tone={roas >= 2 ? "success" : "neutral"}
          hint={`${fmtINR(totalRevenue)} revenue`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {filters.map((f) => {
          const isActive = (filterStatus ?? "all") === (f.key ?? "all");
          return (
            <Link
              key={f.label}
              href={f.href}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isActive
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-200 hover:border-ink-300"
              }`}
            >
              {f.label}
              {typeof f.count === "number" && (
                <span className={`tabular-nums ${isActive ? "text-white/70" : "text-ink-400"}`}>{f.count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            title={filterStatus ? `No ${(CLIENT_STATUS_LABELS as any)[filterStatus] ?? filterStatus} clients` : "No clients yet"}
            description={filterStatus ? "Adjust the filter or onboard a new client to get started." : "Onboard your first brand to start running campaigns."}
            action={{ label: "+ New client", href: "/app/clients/new" }}
          />
        </Card>
      ) : (
        <>
          <SectionHeader title="Active portfolio" description="Click a card to drill into the client's workspace." />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {clients.map((c) => {
              const spend = c.campaigns.reduce((s, x) => s + x.spent, 0);
              const revenue = c.customers.reduce((s, x) => s + x.revenue, 0);
              const clientRoas = spend > 0 ? revenue / spend : 0;
              const openClientBriefs = c.briefs.filter((b) => !["DELIVERED", "ARCHIVED"].includes(b.status)).length;
              return (
                <Link
                  key={c.id}
                  href={`/app/clients/${c.id}`}
                  className="group relative block rounded-xl border border-ink-200/70 bg-white p-5 transition-all duration-200 hover:border-ink-300 hover:shadow-card-hover focus-ring"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400 font-semibold mb-1">
                        {c.industry || "Brand"}
                      </div>
                      <div className="text-[17px] font-semibold tracking-tight text-ink-900 truncate">{c.businessName}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{c.city ?? "—"} · {c.country ?? "India"}</div>
                    </div>
                    <ClientStatusPill status={c.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 my-4">
                    <Mini label="Spend" value={fmtINR(spend)} />
                    <Mini label="Leads" value={fmtNum(c._count.leads)} />
                    <Mini label="ROAS" value={`${clientRoas.toFixed(2)}×`} positive={clientRoas >= 1} />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-ink-100">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="neutral">{c.tier}</Badge>
                      <Badge variant="brand" dot>{creativePreferenceLabel(c.creativePreference)}</Badge>
                      {openClientBriefs > 0 && (
                        <Badge variant="accent" dot>{openClientBriefs} brief{openClientBriefs === 1 ? "" : "s"}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-ink-400 group-hover:text-brand-600 transition-colors">
                      {c.contractStart ? `Since ${fmtDate(c.contractStart)}` : "New"} →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <SectionHeader
            title="Full roster"
            description="A tabular view across every client — useful for spreadsheet-style work."
          />
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/60">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Preference</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Campaigns</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Monthly budget</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/app/clients/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                        {c.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{c.industry ?? "—"}</td>
                    <td className="px-4 py-3"><ClientStatusPill status={c.status} /></td>
                    <td className="px-4 py-3 text-ink-700">{c.tier}</td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{creativePreferenceLabel(c.creativePreference)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      <div>{c.contactName}</div>
                      <div className="text-xs text-ink-400">{c.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c._count.campaigns}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c._count.leads}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtINR(c.monthlyBudget ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{fmtRelative(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold mb-0.5">{label}</div>
      <div className={`text-[15px] font-semibold tabular-nums tracking-tight ${positive === false ? "text-rose-600" : "text-ink-900"}`}>{value}</div>
    </div>
  );
}

function ClientStatusPill({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    ACTIVE: { variant: "success", label: "Active" },
    ONBOARDING: { variant: "info", label: "Onboarding" },
    PAUSED: { variant: "warning", label: "Paused" },
    CHURNED: { variant: "neutral", label: "Churned" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
