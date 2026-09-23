// Adziga — /app/admin
// Operational command center for the Adziga team. System health, integration
// status, pending approvals, recent audit log. Editorial layout — clean
// hierarchy, action-oriented CTAs.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, Kpi, SectionHeader } from "@/app/app/_components/ui";
import { fmtNum, fmtRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const [
    activeClients,
    runningCampaigns,
    pausedCampaigns,
    openRequests,
    openTasks,
    unreadNotifications,
    activeAlerts,
    integrations,
    recentAudit,
    pendingApprovals,
    pendingApprovalsBySeverity
  ] = await Promise.all([
    prisma.client.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { orgId: session.orgId, status: "PAUSED" } }),
    prisma.clientRequest.count({ where: { orgId: session.orgId, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.notification.count({ where: { userId: session.userId, read: false } }),
    prisma.campaign.count({ where: { orgId: session.orgId, OR: [{ health: "At Risk" }, { health: "Critical" }] } }),
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.auditLog.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.approval.count({ where: { orgId: session.orgId, status: "pending" } }),
    prisma.approval.groupBy({
      by: ["severity"],
      where: { orgId: session.orgId, status: "pending" },
      _count: { _all: true }
    })
  ]);

  const criticalCount = pendingApprovalsBySeverity.find((g) => g.severity === "critical")?._count._all ?? 0;
  const importantCount = pendingApprovalsBySeverity.find((g) => g.severity === "important")?._count._all ?? 0;
  const integrationsHealthy = integrations.filter((i) => i.status === "HEALTHY").length;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Operations"
        subtitle="System health, integrations, pending approvals, and audit. The Adziga team uses this view to keep client accounts safe and humming."
        right={
          <div className="flex items-center gap-2">
            <Link href="/app/admin/approvals"><Button variant={pendingApprovals > 0 ? "primary" : "outline"}>
              Approvals {pendingApprovals > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-brand-700 text-[10px] font-semibold">{pendingApprovals}</span>}
            </Button></Link>
            <Link href="/app/admin/auto-approve"><Button variant="outline">Auto-approve</Button></Link>
            <Link href="/app/admin/integrations"><Button variant="outline">Integrations</Button></Link>
            <Link href="/app/audit"><Button variant="outline">Audit</Button></Link>
            <Link href="/app/admin/webhooks"><Button variant="outline">Webhooks</Button></Link>
            <Link href="/app/admin/agents"><Button variant="outline">Agents</Button></Link>
          </div>
        }
      />

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Active clients"
          value={activeClients}
          tone="brand"
          hint={`${runningCampaigns} campaigns running`}
        />
        <Kpi
          label="Pending approvals"
          value={pendingApprovals}
          tone={pendingApprovals > 0 ? "accent" : "neutral"}
          hint={`${criticalCount} critical · ${importantCount} important`}
        />
        <Kpi
          label="Health alerts"
          value={activeAlerts}
          tone={activeAlerts > 0 ? "accent" : "success"}
          hint={`${pausedCampaigns} campaigns paused`}
        />
        <Kpi
          label="Integrations"
          value={`${integrationsHealthy}/${integrations.length}`}
          tone={integrationsHealthy === integrations.length && integrations.length > 0 ? "success" : "neutral"}
          hint="healthy"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Open requests" value={openRequests} />
        <Kpi label="Tasks pending" value={openTasks} />
        <Kpi label="Unread notifications" value={unreadNotifications} />
        <Kpi label="Audit (24h)" value={recentAudit.length} hint="entries" />
      </div>

      {/* Approvals + Integrations + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-8">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Approval queue</h3>
              <p className="text-xs text-ink-500 mt-0.5">Client-initiated changes waiting on your sign-off</p>
            </div>
            <Link href="/app/admin/approvals" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Open queue →</Link>
          </div>
          <div className="px-5 py-5">
            {pendingApprovals === 0 ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="text-sm font-medium text-ink-900">Inbox zero</div>
                <div className="text-xs text-ink-500 mt-1">No pending approvals. Critical changes will land here.</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="danger" dot>{criticalCount} critical</Badge>
                    <Badge variant="warning" dot>{importantCount} important</Badge>
                  </div>
                  <div className="text-xs text-ink-500">{pendingApprovals} total</div>
                </div>
                <Link href="/app/admin/approvals" className="block">
                  <Button>Review approvals</Button>
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">Integration health</h3>
              <p className="text-xs text-ink-500 mt-0.5">External services powering client accounts</p>
            </div>
            <Link href="/app/admin/integrations" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Manage →</Link>
          </div>
          {integrations.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-500">
              No integrations connected yet.
              <div className="mt-2">
                <Link href="/app/admin/integrations" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Add one →</Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {integrations.slice(0, 6).map((i) => (
                <li key={i.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">{i.provider}</div>
                    <div className="text-xs text-ink-500 mt-0.5">Last sync {i.lastSyncAt ? fmtRelative(i.lastSyncAt) : "never"}</div>
                  </div>
                  <IntegrationStatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SectionHeader
        title="Recent audit"
        description="Every change to a critical entity is logged. View the full audit to investigate."
        actions={<Link href="/app/audit"><Button variant="outline" size="sm">View full audit</Button></Link>}
      />
      <Card padding="none">
        {recentAudit.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-500">No audit entries yet.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {recentAudit.slice(0, 10).map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    <code className="text-[12px] font-mono text-ink-700">{a.action}</code>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {a.entityType ? <>{a.entityType} · </> : null}
                    {a.entityId ? <code className="text-[11px]">{a.entityId.slice(0, 10)}</code> : null}
                  </div>
                </div>
                <span className="text-xs text-ink-400 shrink-0">{fmtRelative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function IntegrationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    HEALTHY: { variant: "success", label: "Healthy" },
    DEGRADED: { variant: "warning", label: "Degraded" },
    DOWN: { variant: "danger", label: "Down" },
    PENDING: { variant: "info", label: "Pending" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
