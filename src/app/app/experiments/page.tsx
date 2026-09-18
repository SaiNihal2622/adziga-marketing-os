import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtDate, fmtNum } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createExperiment(formData: FormData) {
  "use server";
  const session = await requireSession();
  const e = await prisma.experiment.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? "") || undefined,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      title: String(formData.get("title") ?? "").trim(),
      hypothesis: String(formData.get("hypothesis") ?? "").trim(),
      variable: String(formData.get("variable") ?? "").trim(),
      control: String(formData.get("control") ?? ""),
      treatment: String(formData.get("treatment") ?? ""),
      audience: String(formData.get("audience") ?? "") || null,
      budget: Number(formData.get("budget") ?? 0) || null,
      durationDays: Number(formData.get("durationDays") ?? 14),
      kpi: String(formData.get("kpi") ?? ""),
      expectedResult: String(formData.get("expectedResult") ?? "") || null,
      status: "PLANNED"
    }
  });
  await audit(session.orgId, session.userId, "experiment.create", { entityType: "Experiment", entityId: e.id });
  redirect(`/app/experiments/${e.id}`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const data: any = { status: to };
  if (to === "RUNNING") data.startedAt = new Date();
  if (to === "COMPLETED") data.completedAt = new Date();
  await prisma.experiment.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "experiment.status_change", { entityType: "Experiment", entityId: id, after: { status: to } });
}

export default async function ExperimentsPage() {
  const session = await requireSession();
  const experiments = await prisma.experiment.findMany({
    where: { orgId: session.orgId },
    include: { client: true, campaign: true },
    orderBy: { createdAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });
  const campaigns = await prisma.campaign.findMany({ where: { orgId: session.orgId }, include: { client: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiments"
        subtitle="Hypothesis-driven A/B infrastructure. Each experiment becomes structured training data for the future Strategy Intelligence engine."
      />

      <form action={createExperiment} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="Video hook: founder vs testimonial" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Hypothesis</label>
          <textarea name="hypothesis" required rows={2} className="input" placeholder="If X, then Y, because Z" />
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="input">
            <option value="">- Internal -</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Campaign</label>
          <select name="campaignId" className="input">
            <option value="">- None -</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.client.businessName} - {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">KPI</label>
          <input name="kpi" required className="input" placeholder="qualified_lead_rate" />
        </div>
        <div>
          <label className="label">Variable being tested</label>
          <input name="variable" required className="input" placeholder="creative_hook" />
        </div>
        <div>
          <label className="label">Audience</label>
          <input name="audience" className="input" placeholder="HNI 35-55" />
        </div>
        <div>
          <label className="label">Budget ()</label>
          <input name="budget" type="number" className="input" />
        </div>
        <div>
          <label className="label">Duration (days)</label>
          <input name="durationDays" type="number" defaultValue={14} className="input" />
        </div>
        <div>
          <label className="label">Expected result</label>
          <input name="expectedResult" className="input" placeholder="+15% qualified_lead_rate" />
        </div>
        <div className="md:col-span-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Control</label>
            <textarea name="control" rows={3} required className="input" placeholder='{"hook_type": "testimonial"}' />
          </div>
          <div>
            <label className="label">Treatment</label>
            <textarea name="treatment" rows={3} required className="input" placeholder='{"hook_type": "founder_led"}' />
          </div>
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Plan experiment</button>
        </div>
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        {experiments.map((e) => (
          <div key={e.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-ink-500">{e.client?.businessName ?? "Internal"} - {e.kpi}</div>
                <div className="font-semibold mt-1">{e.title}</div>
              </div>
              <StatusPill status={e.status} />
            </div>
            <p className="text-sm text-ink-700 mt-2 italic">"{e.hypothesis}"</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="bg-ink-50 rounded p-2">
                <div className="font-semibold text-ink-700 mb-1">Control</div>
                <div className="font-mono">{e.control}</div>
              </div>
              <div className="bg-brand-50 rounded p-2">
                <div className="font-semibold text-brand-700 mb-1">Treatment</div>
                <div className="font-mono">{e.treatment}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div><span className="text-ink-500">Expected:</span> {e.expectedResult ?? "-"}</div>
              <div><span className="text-ink-500">Actual:</span> {e.actualResult ?? "-"}</div>
            </div>
            {e.conclusion && <div className="text-xs mt-2 badge badge-success">{e.conclusion}</div>}
            <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap gap-2">
              {["PLANNED", "RUNNING", "COMPLETED", "CANCELLED"].filter((s) => s !== e.status).map((s) => (
                <form action={transition} key={s}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="to" value={s} />
                  <button className="btn btn-secondary btn-sm"> {s}</button>
                </form>
              ))}
              <Link href={`/app/experiments/${e.id}`} className="ml-auto btn btn-ghost btn-sm">Open </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}