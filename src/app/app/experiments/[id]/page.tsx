import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function record(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const data = {
    actualResult: String(formData.get("actualResult") ?? "") || null,
    conclusion: String(formData.get("conclusion") ?? "") || null,
    evaluatedAt: new Date(),
    status: "COMPLETED",
    completedAt: new Date()
  };
  await prisma.experiment.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "experiment.evaluate", { entityType: "Experiment", entityId: id, after: data });
}

export default async function ExperimentDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const e = await prisma.experiment.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { client: true, campaign: true }
  });
  if (!e) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={e.title}
        subtitle={`${e.client?.businessName ?? "Internal"} - ${e.kpi}`}
        breadcrumbs={[{ label: "Experiments", href: "/app/experiments" }, { label: e.title }]}
        right={<StatusPill status={e.status} />}
      />

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Hypothesis</h3>
        <p className="italic text-ink-700">"{e.hypothesis}"</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-2">Control</h3>
          <pre className="bg-ink-50 p-3 rounded font-mono text-xs">{e.control}</pre>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-2">Treatment</h3>
          <pre className="bg-brand-50 p-3 rounded font-mono text-xs">{e.treatment}</pre>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Audience" value={e.audience ?? "-"} />
        <Kpi label="Budget" value={`${(e.budget ?? 0).toLocaleString("en-IN")}`} />
        <Kpi label="Duration" value={`${e.durationDays} days`} />
        <Kpi label="KPI" value={e.kpi} />
        <Kpi label="Started" value={fmtDate(e.startedAt)} />
        <Kpi label="Completed" value={fmtDate(e.completedAt)} />
        <Kpi label="Expected" value={e.expectedResult ?? "-"} />
        <Kpi label="Actual" value={e.actualResult ?? "-"} />
      </div>

      <form action={record} className="card p-5 space-y-3">
        <input type="hidden" name="id" value={e.id} />
        <h3 className="text-sm font-semibold text-ink-700">Record result</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Actual result</label>
            <input name="actualResult" defaultValue={e.actualResult ?? ""} className="input" placeholder="+9% qualified_lead_rate" />
          </div>
          <div>
            <label className="label">Conclusion</label>
            <select name="conclusion" defaultValue={e.conclusion ?? ""} className="input">
              <option value="">- Select -</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Partially Confirmed">Partially Confirmed</option>
              <option value="Refuted">Refuted</option>
              <option value="Inconclusive">Inconclusive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm">Save & mark complete</button>
        </div>
      </form>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="kpi-label">{label}</div><div className="kpi-value text-base">{value}</div></div>;
}