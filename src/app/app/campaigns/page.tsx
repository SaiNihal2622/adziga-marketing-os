// Adziga — /app/campaigns
// Multi-channel execution with KPI summary, status filter pills, and a polished
// table that surfaces health + lifecycle counts at the bottom.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, EmptyState, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtINR, fmtNum, fmtRelative } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/constants";
import { RecomputeHealthButton } from "./recompute-health-button";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams
}: {
  searchParams: { clientId?: string; status?: string; platform?: string };
}) {
  const session = await requireSession();
  const where: any = { orgId: session.orgId };
  if (searchParams.clientId) where.clientId = searchParams.clientId;
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.platform) where.platform = searchParams.platform;

  const [campaigns, clients] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        client: { select: { id: true, businessName: true } },
        _count: { select: { adSets: true, ads: true, creatives: true, leadEntries: true, briefs: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  // KPIs across filtered scope
  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const cpl_ = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const roas_ = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Sprint 16b — health tier breakdown for the filtered scope
  const healthCounts = {
    healthy: campaigns.filter((c) => c.health === "Healthy").length,
    atRisk: campaigns.filter((c) => c.health === "At Risk").length,
    critical: campaigns.filter((c) => c.health === "Critical").length
  };

  const STATUS_OPTIONS: Array<{ key?: string; label: string }> = [
    { label: "All" },
    { key: "DRAFT", label: "Draft" },
    { key: "INTERNAL_REVIEW", label: "Internal review" },
    { key: "CLIENT_APPROVAL", label: "Client approval" },
    { key: "READY", label: "Ready" },
    { key: "ACTIVE", label: "Active" },
    { key: "PAUSED", label: "Paused" },
    { key: "COMPLETED", label: "Completed" },
    { key: "ARCHIVED", label: "Archived" }
  ];

  function statusHref(key?: string) {
    const params = new URLSearchParams({ ...searchParams } as any);
    if (key) params.set("status", key);
    else params.delete("status");
    return `/app/campaigns${params.toString() ? "?" + params.toString() : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Execution"
        title="Campaigns"
        subtitle="Multi-channel execution. Lifecycle: Draft → Internal review → Client approval → Ready → Active → Paused → Completed."
        breadcrumbs={[{ label: "Campaigns" }]}
        right={
          <div className="flex items-center gap-2">
            <RecomputeHealthButton />
            <Link href="/app/campaigns/new">
              <Button>+ New campaign</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <Kpi label="Total campaigns" value={campaigns.length.toString()} hint={`${activeCampaigns} active`} />
        <Kpi label="Spend" value={fmtINR(totalSpend)} tone="brand" />
        <Kpi label="Leads" value={fmtNum(totalLeads)} hint={`${fmtINR(cpl_)} CPL`} />
        <Kpi label="Revenue" value={fmtINR(totalRevenue)} />
        <Kpi label="ROAS" value={`${roas_.toFixed(2)}×`} tone={roas_ >= 2 ? "success" : "neutral"} />
      </div>

      {/* Sprint 16b — health-tier strip */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Health</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {healthCounts.healthy} healthy
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {healthCounts.atRisk} at risk
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {healthCounts.critical} critical
          </span>
          <span className="text-xs text-ink-500">
            Composite score from spend pacing, ROAS vs peers, lead trend, anomaly detector, CTR floor. Click
            "Recompute health" to refresh.
          </span>
        </div>
      </Card>

      <Card padding="sm" className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const isActive = (searchParams.status ?? "") === (s.key ?? "");
            return (
              <Link
                key={s.label}
                href={statusHref(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-ink-900 text-white"
                    : "bg-transparent text-ink-700 hover:bg-ink-100"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        {clients.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mr-2">Client</span>
            <Link
              href={statusHref(undefined).replace(/&?clientId=[^&]*/, "")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                !searchParams.clientId ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              All
            </Link>
            {clients.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/app/campaigns?clientId=${c.id}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  searchParams.clientId === c.id ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {c.businessName}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaigns in this view"
            description={searchParams.status || searchParams.clientId ? "Try clearing the filters above." : "Create your first campaign from scratch or use the Strategy Agent."}
            action={{ label: "+ New campaign", href: "/app/campaigns/new" }}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">ROAS</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const cpl = Number(c.leads) > 0 ? c.spent / Number(c.leads) : 0;
                const ro = c.spent > 0 ? c.revenue / c.spent : 0;
                return (
                  <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/app/campaigns/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600 transition-colors">
                        {c.name}
                      </Link>
                      <div className="text-xs text-ink-500 mt-0.5">{c.objective}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      <Link href={`/app/clients/${c.clientId}`} className="hover:text-brand-600 transition-colors">
                        {c.client.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{PLATFORM_LABELS[c.platform as keyof typeof PLATFORM_LABELS] ?? c.platform}</Badge>
                    </td>
                    <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><HealthBadge health={c.health} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtINR(c.budget ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtINR(c.spent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNum(c.leads)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={ro >= 2 ? "text-emerald-700 font-medium" : ro >= 1 ? "text-ink-900" : "text-rose-700"}>
                        {c.spent > 0 ? `${ro.toFixed(2)}×` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/app/campaigns/${c.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Lifecycle snapshot */}
      <SectionHeader title="Lifecycle snapshot" description="Where campaigns sit in the workflow right now." />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {["DRAFT", "INTERNAL_REVIEW", "CLIENT_APPROVAL", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].map((s, i) => {
          const count = campaigns.filter((c) => c.status === s).length;
          return (
            <div key={s} className="rounded-lg border border-ink-200/70 bg-white p-3 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.12em] text-ink-400 font-semibold">Step {i + 1}</div>
              <div className="text-[12px] font-medium text-ink-700 mt-0.5">{s.replace(/_/g, " ")}</div>
              <div className="text-xl font-semibold text-ink-900 mt-1.5 tabular-nums tracking-tight">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

function HealthBadge({ health }: { health: string | null }) {
  if (!health) return <span className="text-xs text-ink-400">—</span>;
  const map: Record<string, { variant: any }> = {
    Healthy: { variant: "success" },
    "At Risk": { variant: "warning" },
    Critical: { variant: "danger" }
  };
  const m = map[health] ?? { variant: "neutral" };
  return <Badge variant={m.variant} dot>{health}</Badge>;
}
