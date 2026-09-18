import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtDate, relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();
  const [
    activeClients,
    runningCampaigns,
    pausedCampaigns,
    openRequests,
    overdueTasks,
    newNotifications,
    activeAlerts,
    integrations,
    recentAudit
  ] = await Promise.all([
    prisma.client.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { orgId: session.orgId, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { orgId: session.orgId, status: "PAUSED" } }),
    prisma.clientRequest.count({ where: { orgId: session.orgId, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.notification.count({ where: { userId: session.userId, read: false } }),
    prisma.campaign.count({ where: { orgId: session.orgId, OR: [{ health: "At Risk" }, { health: "Critical" }] } }),
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.auditLog.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        subtitle="Operational command center - system health, integrations, AI activity, and audit."
        right={
          <div className="flex items-center gap-2">
            <Link href="/app/admin/integrations" className="btn btn-secondary btn-sm">Integrations</Link>
            <Link href="/app/admin/billing" className="btn btn-secondary btn-sm">Billing</Link>
            <Link href="/app/audit" className="btn btn-secondary btn-sm">Audit</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Active clients" value={fmtNum(activeClients)} />
        <Kpi label="Running campaigns" value={fmtNum(runningCampaigns)} />
        <Kpi label="Paused campaigns" value={fmtNum(pausedCampaigns)} />
        <Kpi label="Open requests" value={fmtNum(openRequests)} />
        <Kpi label="Tasks pending" value={fmtNum(overdueTasks)} />
        <Kpi label="Active alerts" value={fmtNum(activeAlerts)} />
        <Kpi label="Unread notifications" value={fmtNum(newNotifications)} />
        <Kpi label="Integrations" value={`${integrations.filter((i) => i.status === "HEALTHY").length}/${integrations.length} healthy`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Integration health</h3>
          <ul className="divide-y divide-ink-100">
            {integrations.map((i) => (
              <li key={i.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{i.provider}</div>
                  <div className="text-xs text-ink-500">Last sync: {i.lastSyncAt ? relTime(i.lastSyncAt) : "-"}</div>
                </div>
                <StatusPill status={i.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent audit log</h3>
          <ul className="divide-y divide-ink-100">
            {recentAudit.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-xs text-ink-500">{relTime(a.createdAt)}</span>
                </div>
                <div className="text-xs text-ink-600">{a.entityType ?? ""} {a.entityId ?? ""}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value text-lg">{value}</div>
    </div>
  );
}