import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { fmtDate } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createDecision(formData: FormData) {
  "use server";
  const session = await requireSession();
  const d = await prisma.decisionLog.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? "") || undefined,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      decisionType: String(formData.get("decisionType") ?? "OTHER"),
      decision: String(formData.get("decision") ?? "").trim(),
      reason: String(formData.get("reason") ?? "").trim(),
      hypothesis: String(formData.get("hypothesis") ?? "") || null,
      expectedOutcome: String(formData.get("expectedOutcome") ?? "") || null,
      authorId: session.userId
    }
  });
  await audit(session.orgId, session.userId, "decision.create", { entityType: "DecisionLog", entityId: d.id });
  redirect(`/app/decisions`);
}

export default async function DecisionsPage() {
  const session = await requireSession();
  const decisions = await prisma.decisionLog.findMany({
    where: { orgId: session.orgId },
    include: { client: true, campaign: true, author: true },
    orderBy: { createdAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });
  const campaigns = await prisma.campaign.findMany({ where: { orgId: session.orgId }, include: { client: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision log"
        subtitle="Every marketing decision is recorded with hypothesis, expected vs actual outcome, and evaluation. This becomes training data for future intelligence."
      />

      <form action={createDecision} className="card p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Decision type</label>
            <select name="decisionType" className="input">
              {["BUDGET_CHANGE","CREATIVE_CHANGE","AUDIENCE_CHANGE","CHANNEL_CHANGE","PAUSE_CAMPAIGN","LAUNCH_CAMPAIGN","SCALE_CAMPAIGN","STRATEGY_UPDATE","EXPERIMENT","OTHER"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Client</label>
            <select name="clientId" className="input">
              <option value="">— Internal —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Campaign</label>
            <select name="campaignId" className="input">
              <option value="">— None —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Decision</label>
          <input name="decision" required className="input" placeholder="Increased Meta budget by 25%" />
        </div>
        <div>
          <label className="label">Reason</label>
          <input name="reason" required className="input" placeholder="Meta CPL 18% below Google — opportunity to scale" />
        </div>
        <div>
          <label className="label">Hypothesis</label>
          <input name="hypothesis" className="input" placeholder="If we scale, blended CPL stays below ₹400" />
        </div>
        <div>
          <label className="label">Expected outcome</label>
          <input name="expectedOutcome" className="input" placeholder="Blended CPL stays below ₹400" />
        </div>
        <div className="flex justify-end"><button className="btn btn-primary">+ Log decision</button></div>
      </form>

      <div className="space-y-3">
        {decisions.map((d) => (
          <div key={d.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-ink-500">{d.decisionType.replace(/_/g, " ")} · {d.client?.businessName ?? "Internal"} · {d.campaign?.name ?? ""} · {fmtDate(d.createdAt)}</div>
                <div className="font-semibold mt-1">{d.decision}</div>
              </div>
              {d.evaluation && <span className="badge badge-success">{d.evaluation}</span>}
            </div>
            <div className="text-sm text-ink-700 mt-2">{d.reason}</div>
            {(d.hypothesis || d.expectedOutcome || d.actualOutcome) && (
              <div className="mt-3 grid md:grid-cols-3 gap-2 text-xs">
                {d.hypothesis && <div><span className="text-ink-500 font-semibold">Hypothesis:</span> {d.hypothesis}</div>}
                {d.expectedOutcome && <div><span className="text-ink-500 font-semibold">Expected:</span> {d.expectedOutcome}</div>}
                {d.actualOutcome && <div><span className="text-ink-500 font-semibold">Actual:</span> {d.actualOutcome}</div>}
              </div>
            )}
            <div className="text-xs text-ink-500 mt-3">By {d.author.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}