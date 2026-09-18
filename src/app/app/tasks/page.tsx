import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtDate, relTime } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createTask(formData: FormData) {
  "use server";
  const session = await requireSession();
  const t = await prisma.task.create({
    data: {
      orgId: session.orgId,
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "") || null,
      priority: String(formData.get("priority") ?? "MEDIUM"),
      status: "TODO",
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
      creatorId: session.userId,
      assigneeId: String(formData.get("assigneeId") ?? "") || undefined,
      clientId: String(formData.get("clientId") ?? "") || undefined
    }
  });
  await audit(session.orgId, session.userId, "task.create", { entityType: "Task", entityId: t.id });
  redirect(`/app/tasks`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  await prisma.task.update({ where: { id }, data: { status: to } });
  await audit(session.orgId, session.userId, "task.status_change", { entityType: "Task", entityId: id, after: { status: to } });
}

export default async function TasksPage() {
  const session = await requireSession();
  const [tasks, members, clients] = await Promise.all([
    prisma.task.findMany({
      where: { orgId: session.orgId },
      include: { assignee: true, creator: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }]
    }),
    prisma.user.findMany({
      where: { memberships: { some: { orgId: session.orgId } } },
      orderBy: { name: "asc" }
    }),
    prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } })
  ]);

  const byStatus = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    BLOCKED: tasks.filter((t) => t.status === "BLOCKED"),
    DONE: tasks.filter((t) => t.status === "DONE")
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Internal operational work. Kanban: TODO  IN_PROGRESS  BLOCKED  DONE."
      />

      <form action={createTask} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div>
          <label className="label">Due date</label>
          <input name="dueDate" type="date" className="input" />
        </div>
        <div>
          <label className="label">Assignee</label>
          <select name="assigneeId" className="input">
            <option value="">- Unassigned -</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="input">
            <option value="">- None -</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Description</label>
          <textarea name="description" rows={2} className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Create task</button>
        </div>
      </form>

      <div className="grid md:grid-cols-4 gap-4">
        {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => (
          <div key={status} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-700">{status.replace(/_/g, " ")}</h3>
              <span className="badge badge-neutral">{byStatus[status].length}</span>
            </div>
            <ul className="space-y-2">
              {byStatus[status].map((t) => (
                <li key={t.id} className="card p-3 border-ink-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{t.title}</div>
                    <span className={`badge ${t.priority === "URGENT" ? "badge-danger" : t.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{t.priority}</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">{t.assignee?.name ?? "Unassigned"} - {t.dueDate ? `due ${fmtDate(t.dueDate)}` : "no due date"}</div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).filter((s) => s !== t.status).map((s) => (
                      <form action={transition} key={s}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="to" value={s} />
                        <button className="btn btn-secondary btn-sm">{s.replace(/_/g, " ")}</button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}