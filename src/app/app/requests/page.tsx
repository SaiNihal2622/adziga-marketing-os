import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtDateTime, relTime } from "@/lib/format";
import { REQUEST_CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createRequest(formData: FormData) {
  "use server";
  const session = await requireSession();
  const r = await prisma.clientRequest.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? ""),
      submitterId: session.userId,
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? "OTHER"),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      status: "SUBMITTED"
    }
  });
  await audit(session.orgId, session.userId, "request.create", { entityType: "ClientRequest", entityId: r.id });
  redirect(`/app/requests`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const data: any = { status: to };
  if (to === "RESOLVED") data.resolvedAt = new Date();
  await prisma.clientRequest.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "request.status_change", { entityType: "ClientRequest", entityId: id, after: { status: to } });
}

export default async function RequestsPage() {
  const session = await requireSession();
  const requests = await prisma.clientRequest.findMany({
    where: { orgId: session.orgId },
    include: { client: true, submitter: true },
    orderBy: { createdAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        subtitle="Client-submitted requests. Statuses: Submitted  Acknowledged  Assigned  In Progress  Waiting Client  Resolved."
      />

      <form action={createRequest} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" required className="input">
            <option value="">Select...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" className="input">
            {Object.entries(REQUEST_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input">
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Description</label>
          <textarea name="description" required rows={3} className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Submit request</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Client</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/app/requests/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.title}</Link>
                  <div className="text-xs text-ink-500 truncate max-w-md">{r.description}</div>
                </td>
                <td>{r.client.businessName}</td>
                <td>{REQUEST_CATEGORY_LABELS[r.category as keyof typeof REQUEST_CATEGORY_LABELS] ?? r.category}</td>
                <td><span className={`badge ${r.priority === "URGENT" ? "badge-danger" : r.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{r.priority}</span></td>
                <td><StatusPill status={r.status} /></td>
                <td className="text-xs">{relTime(r.createdAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {["ACKNOWLEDGED", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"].filter((s) => s !== r.status).slice(0, 2).map((s) => (
                      <form action={transition} key={s}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="to" value={s} />
                        <button className="btn btn-secondary btn-sm">{s.replace(/_/g, " ")}</button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}