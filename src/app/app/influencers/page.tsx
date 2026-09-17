import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtPct, cpl } from "@/lib/format";
import { INFLUENCER_PLATFORM_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createInfluencer(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const i = await prisma.influencer.create({
    data: {
      orgId: session.orgId,
      name,
      handle: String(formData.get("handle") ?? ""),
      platform: String(formData.get("platform") ?? "INSTAGRAM"),
      niche: String(formData.get("niche") ?? "") || null,
      audienceSize: Number(formData.get("audienceSize") ?? 0) || null,
      audienceGeo: String(formData.get("audienceGeo") ?? "") || null,
      contractValue: Number(formData.get("contractValue") ?? 0) || null,
      feeType: String(formData.get("feeType") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null
    }
  });
  await audit(session.orgId, session.userId, "influencer.create", { entityType: "Influencer", entityId: i.id });
  redirect(`/app/influencers/${i.id}`);
}

export default async function InfluencersPage() {
  const session = await requireSession();
  const influencers = await prisma.influencer.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" }
  });

  const totalContract = influencers.reduce((s, i) => s + (i.contractValue ?? 0), 0);
  const totalLeads = influencers.reduce((s, i) => s + i.leadsCount, 0);
  const totalRevenue = influencers.reduce((s, i) => s + i.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Influencers"
        subtitle="Creator-based campaigns with unique tracking tokens, lead attribution, and ROI calculation."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Influencers" value={fmtNum(influencers.length)} />
        <Kpi label="Contracted" value={fmtINR(totalContract)} />
        <Kpi label="Leads driven" value={fmtNum(totalLeads)} />
        <Kpi label="Revenue" value={fmtINR(totalRevenue)} />
      </div>

      {/* New influencer form */}
      <form action={createInfluencer} className="card p-5 grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" placeholder="Aanya Khurana" />
        </div>
        <div>
          <label className="label">Handle</label>
          <input name="handle" required className="input" placeholder="@aanyainvests" />
        </div>
        <div>
          <label className="label">Platform</label>
          <select name="platform" className="input">
            {Object.entries(INFLUENCER_PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Niche</label>
          <input name="niche" className="input" />
        </div>
        <div>
          <label className="label">Audience size</label>
          <input name="audienceSize" type="number" className="input" />
        </div>
        <div>
          <label className="label">Audience geo</label>
          <input name="audienceGeo" className="input" />
        </div>
        <div>
          <label className="label">Contract value (₹)</label>
          <input name="contractValue" type="number" className="input" />
        </div>
        <div>
          <label className="label">Fee type</label>
          <select name="feeType" className="input">
            <option value="fixed">Fixed</option>
            <option value="performance">Performance</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Notes</label>
          <input name="notes" className="input" />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Add influencer</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {influencers.map((i) => (
          <Link href={`/app/influencers/${i.id}`} key={i.id} className="card p-5 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{i.name}</div>
                <div className="text-xs text-ink-500">{i.handle}</div>
              </div>
              <span className="badge badge-neutral">{INFLUENCER_PLATFORM_LABELS[i.platform as keyof typeof INFLUENCER_PLATFORM_LABELS] ?? i.platform}</span>
            </div>
            {i.niche && <div className="text-xs text-ink-600 mt-2">{i.niche}</div>}
            <div className="text-xs text-ink-500 mt-2">{fmtNum(i.audienceSize ?? 0)} followers · {i.audienceGeo ?? "—"}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><div className="font-bold text-ink-900 text-sm">{fmtNum(i.leadsCount)}</div>Leads</div>
              <div><div className="font-bold text-ink-900 text-sm">{fmtNum(i.qualifiedLeads)}</div>Qualified</div>
              <div><div className="font-bold text-ink-900 text-sm">{fmtINR(i.revenue)}</div>Revenue</div>
            </div>
            {i.contractValue && (
              <div className="mt-2 text-xs">Contract: {fmtINR(i.contractValue)} ({i.feeType ?? "—"})</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="kpi-label">{label}</div><div className="kpi-value text-lg">{value}</div></div>;
}