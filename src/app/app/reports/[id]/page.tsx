import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtDate, fmtINR } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function saveSection(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const r = await prisma.report.findFirst({ where: { id, orgId: session.orgId } });
  if (!r) return;
  const data = {
    executiveSummary: String(formData.get("executiveSummary") ?? "") || null,
    performance: String(formData.get("performance") ?? "") || null,
    campaignAnalysis: String(formData.get("campaignAnalysis") ?? "") || null,
    funnel: String(formData.get("funnel") ?? "") || null,
    leadQuality: String(formData.get("leadQuality") ?? "") || null,
    creativePerformance: String(formData.get("creativePerformance") ?? "") || null,
    recommendations: String(formData.get("recommendations") ?? "") || null,
    nextActions: String(formData.get("nextActions") ?? "") || null
  };
  await prisma.report.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "report.update", { entityType: "Report", entityId: id, after: data });
}

async function publish(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  await prisma.report.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() }
  });
  // also send notification to all client users
  const r = await prisma.report.findUnique({ where: { id } });
  if (r) {
    const members = await prisma.user.findMany({ where: { memberships: { some: { orgId: r.clientId } } } });
    for (const m of members) {
      await prisma.notification.create({
        data: {
          orgId: r.orgId,
          userId: m.id,
          type: "report_ready",
          title: `New report available: ${r.title}`,
          message: "Your latest performance report has been published.",
          link: `/app/reports/${r.id}`,
          channel: "in-app"
        }
      });
    }
  }
  await audit(session.orgId, session.userId, "report.publish", { entityType: "Report", entityId: id });
  redirect(`/app/reports/${id}`);
}

export default async function ReportDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const r = await prisma.report.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, campaign: true }
  });
  if (!r) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.title}
        subtitle={`${r.client.businessName} · ${fmtDate(r.periodStart)} → ${fmtDate(r.periodEnd)}`}
        breadcrumbs={[{ label: "Reports", href: "/app/reports" }, { label: r.title }]}
        right={
          <>
            <StatusPill status={r.status} />
            {r.status === "DRAFT" && (
              <form action={publish}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn btn-primary btn-sm">Publish</button>
              </form>
            )}
          </>
        }
      />

      <form action={saveSection} className="card p-6 space-y-5">
        <input type="hidden" name="id" value={r.id} />
        <Section title="Executive Summary" subtitle="What happened? 2-3 sentences." name="executiveSummary" defaultValue={r.executiveSummary ?? ""} />
        <Section title="Performance" subtitle="What were the numbers? (JSON KPIs)" name="performance" defaultValue={r.performance ?? ""} />
        <Section title="Campaign Analysis" subtitle="Which campaigns produced results?" name="campaignAnalysis" defaultValue={r.campaignAnalysis ?? ""} />
        <Section title="Funnel" subtitle="Where are users dropping? (JSON)" name="funnel" defaultValue={r.funnel ?? ""} />
        <Section title="Lead Quality" subtitle="Are leads converting?" name="leadQuality" defaultValue={r.leadQuality ?? ""} />
        <Section title="Creative Performance" subtitle="Which creatives generated meaningful outcomes?" name="creativePerformance" defaultValue={r.creativePerformance ?? ""} />
        <Section title="Recommendations" subtitle="Human-authored in Phase 0. Future AI suggestions never bypass review." name="recommendations" defaultValue={r.recommendations ?? ""} />
        <Section title="Next Actions" subtitle="What will the team do next?" name="nextActions" defaultValue={r.nextActions ?? ""} />
        <div className="flex justify-end">
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, subtitle, name, defaultValue }: any) {
  return (
    <div>
      <label className="label">{title}</label>
      <p className="text-xs text-ink-500 mb-1">{subtitle}</p>
      <textarea name={name} defaultValue={defaultValue} rows={4} className="input" />
    </div>
  );
}