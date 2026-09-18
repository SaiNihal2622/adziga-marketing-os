import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtDate, fmtINR } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createReport(formData: FormData) {
  "use server";
  const session = await requireSession();
  const r = await prisma.report.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? ""),
      title: String(formData.get("title") ?? "").trim(),
      periodStart: new Date(String(formData.get("periodStart"))),
      periodEnd: new Date(String(formData.get("periodEnd"))),
      status: "DRAFT"
    }
  });
  await audit(session.orgId, session.userId, "report.create", { entityType: "Report", entityId: r.id });
  redirect(`/app/reports/${r.id}`);
}

export default async function ReportsPage() {
  const session = await requireSession();
  const reports = await prisma.report.findMany({
    where: { orgId: session.orgId },
    include: { client: true },
    orderBy: { createdAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Client-facing reports: Executive Summary  Performance  Campaign Analysis  Funnel  Lead Quality  Creatives  Recommendations  Next Actions. Recommendations are human-authored in Phase 0."
      />

      <form action={createReport} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="Acme Realty - October 2026 Performance" />
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" required className="input">
            <option value="">Select...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Period start</label>
          <input name="periodStart" type="date" required className="input" />
        </div>
        <div>
          <label className="label">Period end</label>
          <input name="periodEnd" type="date" required className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Create report</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Link href={`/app/reports/${r.id}`} key={r.id} className="card p-5 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-ink-500">{r.client.businessName} - {fmtDate(r.periodStart)}  {fmtDate(r.periodEnd)}</div>
                <div className="font-semibold mt-1">{r.title}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.executiveSummary && (
              <p className="text-sm text-ink-600 mt-3 line-clamp-3">{r.executiveSummary}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}