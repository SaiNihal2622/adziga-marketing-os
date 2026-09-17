import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtPct, fmtDate, ctr, roas } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: { clientId?: string; status?: string; platform?: string } }) {
  const session = await requireSession();
  const where: any = { orgId: session.orgId };
  if (searchParams.clientId) where.clientId = searchParams.clientId;
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.platform) where.platform = searchParams.platform;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: { client: true, adSets: true, ads: true, _count: { select: { adSets: true, ads: true, creatives: true, leadEntries: true } } },
    orderBy: { createdAt: "desc" }
  });

  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Multi-channel campaign execution with workflow states: Draft → Internal Review → Client Approval → Ready → Active → Paused → Completed."
        right={
          <Link href="/app/campaigns/new" className="btn btn-primary btn-sm">+ New campaign</Link>
        }
      />

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3 text-sm">
        <FilterChip active={!searchParams.clientId} href="/app/campaigns">All clients</FilterChip>
        {clients.map((c) => (
          <FilterChip key={c.id} active={searchParams.clientId === c.id} href={`/app/campaigns?clientId=${c.id}`}>
            {c.businessName}
          </FilterChip>
        ))}
        <div className="w-px h-5 bg-ink-200 mx-2" />
        {["ACTIVE", "PAUSED", "DRAFT", "READY", "COMPLETED", "ARCHIVED"].map((s) => (
          <FilterChip key={s} active={searchParams.status === s} href={`/app/campaigns?${new URLSearchParams({ ...searchParams, status: s })}`}>
            {s}
          </FilterChip>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Client</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Health</th>
              <th className="text-right">Budget</th>
              <th className="text-right">Spend</th>
              <th className="text-right">Impr.</th>
              <th className="text-right">Leads</th>
              <th className="text-right">CPL</th>
              <th className="text-right">ROAS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const cpl = c.spent / Number(c.leads || 1);
              const ro = c.revenue / c.spent;
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/app/campaigns/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.name}</Link>
                    <div className="text-xs text-ink-500">{c.objective}</div>
                  </td>
                  <td><Link href={`/app/clients/${c.clientId}`} className="text-ink-700 hover:underline">{c.client.businessName}</Link></td>
                  <td><span className="badge badge-neutral">{PLATFORM_LABELS[c.platform as keyof typeof PLATFORM_LABELS] ?? c.platform}</span></td>
                  <td><StatusPill status={c.status} /></td>
                  <td>
                    {c.health === "Healthy" && <span className="badge badge-success">Healthy</span>}
                    {c.health === "At Risk" && <span className="badge badge-warning">At Risk</span>}
                    {c.health === "Critical" && <span className="badge badge-danger">Critical</span>}
                  </td>
                  <td className="text-right font-mono text-xs">{fmtINR(c.budget ?? 0)}</td>
                  <td className="text-right font-mono text-xs">{fmtINR(c.spent)}</td>
                  <td className="text-right font-mono text-xs">{fmtNum(c.impressions)}</td>
                  <td className="text-right font-mono text-xs">{fmtNum(c.leads)}</td>
                  <td className="text-right font-mono text-xs">{fmtINR(cpl)}</td>
                  <td className="text-right font-mono text-xs">{c.spent > 0 ? `${ro.toFixed(2)}x` : "—"}</td>
                  <td><Link href={`/app/campaigns/${c.id}`} className="text-brand-600 hover:underline text-xs">View →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Workflow visual */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">Campaign lifecycle</h3>
        <div className="grid grid-cols-2 md:grid-cols-8 gap-2 text-xs">
          {["DRAFT", "INTERNAL_REVIEW", "CLIENT_APPROVAL", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].map((s, i) => {
            const count = campaigns.filter((c) => c.status === s).length;
            return (
              <div key={s} className="card p-3 border-ink-200 text-center">
                <div className="text-[10px] uppercase tracking-wide text-ink-500">Step {i + 1}</div>
                <div className="font-medium mt-1">{s.replace(/_/g, " ")}</div>
                <div className="text-2xl font-bold mt-2 text-brand-600">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ children, href, active }: { children: React.ReactNode; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-xs ${active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
    >
      {children}
    </Link>
  );
}