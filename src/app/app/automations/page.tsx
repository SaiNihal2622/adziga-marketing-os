import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createAutomation(formData: FormData) {
  "use server";
  const session = await requireSession();
  const a = await prisma.automation.create({
    data: {
      orgId: session.orgId,
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "") || null,
      trigger: String(formData.get("trigger") ?? "lead.created"),
      conditions: String(formData.get("conditions") ?? "{}"),
      actions: String(formData.get("actions") ?? "[]"),
      enabled: true
    }
  });
  await audit(session.orgId, session.userId, "automation.create", { entityType: "Automation", entityId: a.id });
  redirect(`/app/automations`);
}

async function toggle(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const a = await prisma.automation.findFirst({ where: { id, orgId: session.orgId } });
  if (!a) return;
  await prisma.automation.update({ where: { id }, data: { enabled: !a.enabled } });
  await audit(session.orgId, session.userId, "automation.toggle", { entityType: "Automation", entityId: id, after: { enabled: !a.enabled } });
}

export default async function AutomationsPage() {
  const session = await requireSession();
  const automations = await prisma.automation.findMany({
    where: { orgId: session.orgId },
    include: { runs: { orderBy: { triggeredAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        subtitle="Deterministic workflow engine. Triggers + conditions + actions. Each automation is auditable and traceable."
      />

      <form action={createAutomation} className="card p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Auto-assign leads by source" />
          </div>
          <div>
            <label className="label">Trigger</label>
            <select name="trigger" className="input">
              <option value="lead.created">lead.created</option>
              <option value="lead.status_change">lead.status_change</option>
              <option value="campaign.spend_threshold">campaign.spend_threshold</option>
              <option value="report.published">report.published</option>
              <option value="client_request.submitted">client_request.submitted</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Conditions (JSON)</label>
            <textarea name="conditions" rows={4} className="input font-mono" defaultValue="{}" />
          </div>
          <div>
            <label className="label">Actions (JSON array)</label>
            <textarea name="actions" rows={4} className="input font-mono" defaultValue='[{"type": "notify.user", "params": {"template": "lead.assigned"}}]' />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary">+ Create automation</button>
        </div>
      </form>

      <div className="grid lg:grid-cols-2 gap-4">
        {automations.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-ink-500 mt-1">Trigger: <span className="font-mono bg-ink-50 px-1 rounded">{a.trigger}</span></div>
                {a.description && <div className="text-sm text-ink-700 mt-2">{a.description}</div>}
              </div>
              <form action={toggle}>
                <input type="hidden" name="id" value={a.id} />
                <button className={`btn ${a.enabled ? "btn-success" : "btn-secondary"} btn-sm`}>{a.enabled ? "Enabled" : "Disabled"}</button>
              </form>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] uppercase text-ink-500 font-semibold">Conditions</div>
                <pre className="bg-ink-50 p-2 rounded text-xs font-mono mt-1 overflow-auto">{a.conditions}</pre>
              </div>
              <div>
                <div className="text-[10px] uppercase text-ink-500 font-semibold">Actions</div>
                <pre className="bg-brand-50 p-2 rounded text-xs font-mono mt-1 overflow-auto">{a.actions}</pre>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between text-xs">
              <div className="text-ink-500">{a.runsCount} total runs · last {relTime(a.lastRunAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}