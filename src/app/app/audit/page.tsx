import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../_components/page-header";
import { fmtDateTime, relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  // Audit log is sensitive — only FOUNDER/ADMIN/Compliance roles can see it.
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const logs = await prisma.auditLog.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const key = l.action.split(".")[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Every meaningful action is recorded with author, before/after, IP, and user agent."
      />
      {Array.from(groups.entries()).map(([group, items]) => (
        <div key={group} className="card overflow-hidden">
          <h3 className="text-sm font-semibold text-ink-700 p-4 uppercase">{group}</h3>
          <table className="table">
            <thead><tr><th>Action</th><th>Entity</th><th>When</th><th>Payload</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.action}</td>
                  <td className="text-xs">{l.entityType ?? "-"} {l.entityId ? <span className="text-ink-500">- {l.entityId.slice(0, 12)}</span> : ""}</td>
                  <td className="text-xs">{relTime(l.createdAt)}</td>
                  <td className="text-xs font-mono text-ink-600 truncate max-w-md">{l.after ?? l.before ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}