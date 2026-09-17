import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { INFLUENCER_PLATFORM_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InfluencerDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const inf = await prisma.influencer.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { leadEntries: true }
  });
  if (!inf) notFound();

  const trackingUrl = `${process.env.NEXTAUTH_URL || "https://adziga.in"}/r/${inf.trackingToken}`;
  const roi = inf.contractValue && inf.contractValue > 0 ? inf.revenue / inf.contractValue : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={inf.name}
        subtitle={`${inf.handle} · ${INFLUENCER_PLATFORM_LABELS[inf.platform as keyof typeof INFLUENCER_PLATFORM_LABELS]}`}
        breadcrumbs={[{ label: "Influencers", href: "/app/influencers" }, { label: inf.name }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Kpi label="Audience" value={fmtNum(inf.audienceSize ?? 0)} />
        <Kpi label="Posts" value={fmtNum(inf.postsDelivered)} />
        <Kpi label="Leads" value={fmtNum(inf.leadsCount)} />
        <Kpi label="Qualified" value={fmtNum(inf.qualifiedLeads)} />
        <Kpi label="Conversions" value={fmtNum(inf.conversions)} />
        <Kpi label="Revenue" value={fmtINR(inf.revenue)} />
        <Kpi label="Contract" value={fmtINR(inf.contractValue ?? 0)} />
        <Kpi label="Fee type" value={inf.feeType ?? "—"} />
        <Kpi label="ROI" value={roi ? `${roi.toFixed(2)}x` : "—"} />
        <Kpi label="CPL" value={inf.leadsCount > 0 ? fmtINR((inf.contractValue ?? 0) / inf.leadsCount) : "—"} />
        <Kpi label="Status" value={inf.active ? "Active" : "Inactive"} />
        <Kpi label="Niche" value={inf.niche ?? "—"} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-2">Tracking link</h3>
        <p className="text-xs text-ink-500 mb-3">Unique token used for attribution. Any lead with this source/touchpoint traces back to this influencer.</p>
        <div className="flex items-center gap-2">
          <code className="bg-ink-100 px-3 py-2 rounded font-mono text-sm flex-1 truncate">{trackingUrl}</code>
          <a href={trackingUrl} target="_blank" className="btn btn-secondary btn-sm">Visit</a>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Leads driven by this influencer</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>City</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {inf.leadEntries.slice(0, 30).map((l) => (
              <tr key={l.id}>
                <td>{l.name ?? l.email ?? "—"}</td>
                <td>{l.city ?? "—"}</td>
                <td><StatusPill status={l.status} /></td>
                <td className="text-xs">{fmtDate(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="kpi-label">{label}</div><div className="kpi-value text-lg">{value}</div></div>;
}