import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { relTime } from "@/lib/format";
import { REQUEST_CATEGORY_LABELS, PRIORITY_LABELS, REQUEST_STATUS_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const data: any = { status: to };
  if (to === "RESOLVED") data.resolvedAt = new Date();
  if (String(formData.get("resolution") ?? "")) data.resolution = String(formData.get("resolution"));
  await prisma.clientRequest.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "request.status_change", { entityType: "ClientRequest", entityId: id, after: { status: to } });
  redirect(`/app/requests/${id}`);
}

async function comment(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const r = await prisma.clientRequest.findFirst({ where: { id, orgId: session.orgId } });
  if (!r) return;
  const existing = r.comments ? JSON.parse(r.comments) : [];
  existing.push({ at: new Date().toISOString(), userId: session.userId, userName: session.userName, body: String(formData.get("body") ?? "") });
  await prisma.clientRequest.update({ where: { id }, data: { comments: JSON.stringify(existing) } });
}

export default async function RequestDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const r = await prisma.clientRequest.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, submitter: true }
  });
  if (!r) notFound();
  const comments = r.comments ? JSON.parse(r.comments) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.title}
        subtitle={`${r.client.businessName} · ${REQUEST_CATEGORY_LABELS[r.category as keyof typeof REQUEST_CATEGORY_LABELS]}`}
        breadcrumbs={[{ label: "Requests", href: "/app/requests" }, { label: r.title }]}
        right={
          <>
            <span className={`badge ${r.priority === "URGENT" ? "badge-danger" : r.priority === "HIGH" ? "badge-warning" : "badge-neutral"}`}>{PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS] ?? r.priority}</span>
            <StatusPill status={r.status} />
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-700 mb-1">Description</h3>
            <p className="text-sm">{r.description}</p>
          </div>
          {r.resolution && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-emerald-700 mb-1">Resolution</div>
              <div className="text-sm">{r.resolution}</div>
            </div>
          )}
          <div className="pt-3 border-t border-ink-100">
            <h3 className="text-sm font-semibold text-ink-700 mb-2">Activity</h3>
            {comments.length === 0 ? <p className="text-sm text-ink-500">No comments yet.</p> :
              <ul className="space-y-2">
                {comments.map((c: any, i: number) => (
                  <li key={i} className="text-sm border-l-2 border-brand-300 pl-3">
                    <div className="font-medium">{c.userName}</div>
                    <div className="text-ink-700">{c.body}</div>
                    <div className="text-xs text-ink-500 mt-1">{relTime(c.at)}</div>
                  </li>
                ))}
              </ul>
            }
            <form action={comment} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="body" required className="input" placeholder="Add a comment…" />
              <button className="btn btn-secondary btn-sm">Comment</button>
            </form>
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink-700">Lifecycle</h3>
          <div className="space-y-2">
            {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => {
              const active = r.status === k;
              const reached = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"].indexOf(r.status) >= Object.keys(REQUEST_STATUS_LABELS).indexOf(k as any);
              return (
                <form action={transition} key={k}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="to" value={k} />
                  <button className={`w-full text-left px-3 py-2 rounded text-sm ${active ? "bg-brand-600 text-white" : reached ? "bg-brand-50 text-brand-700" : "bg-ink-50 hover:bg-ink-100"}`}>
                    {v}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}