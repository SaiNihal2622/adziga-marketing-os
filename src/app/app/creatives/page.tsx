import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtINR, fmtNum, fmtPct, ctr, cpl } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createCreative(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const campaignId = String(formData.get("campaignId") ?? "") || undefined;
  if (!name) return;
  const c = await prisma.creative.create({
    data: {
      orgId: session.orgId,
      campaignId,
      name,
      format: String(formData.get("format") ?? "VIDEO"),
      platform: String(formData.get("platform") ?? "META"),
      hook: String(formData.get("hook") ?? "") || null,
      headline: String(formData.get("headline") ?? "") || null,
      primaryCopy: String(formData.get("primaryCopy") ?? "") || null,
      cta: String(formData.get("cta") ?? "") || null,
      creator: String(formData.get("creator") ?? "") || null,
      audience: String(formData.get("audience") ?? "") || null,
      status: "DRAFT"
    }
  });
  await audit(session.orgId, session.userId, "creative.create", { entityType: "Creative", entityId: c.id, after: { name } });
  redirect(`/app/creatives/${c.id}`);
}

export default async function CreativesPage() {
  const session = await requireSession();
  const creatives = await prisma.creative.findMany({
    where: { orgId: session.orgId },
    include: { campaign: { include: { client: true } } },
    orderBy: { createdAt: "desc" }
  });
  const campaigns = await prisma.campaign.findMany({
    where: { orgId: session.orgId },
    include: { client: true },
    orderBy: { createdAt: "desc" }
  });

  const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
  const totalLeads = creatives.reduce((s, c) => s + Number(c.leads), 0);
  const totalConv = creatives.reduce((s, c) => s + Number(c.conversions), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creatives"
        subtitle="Centralized creative library. Every creative stores hook, headline, copy, CTA, creator, audience, and performance. This is the future content intelligence layer."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total creatives" value={fmtNum(creatives.length)} />
        <Kpi label="Spend tracked" value={fmtINR(totalSpend)} />
        <Kpi label="Leads driven" value={fmtNum(totalLeads)} />
        <Kpi label="Conversions" value={fmtNum(totalConv)} />
      </div>

      {/* New creative form */}
      <form action={createCreative} className="card p-5 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="label">Creative name</label>
          <input name="name" required className="input" placeholder="Dubai Hero - Founder Story v2" />
        </div>
        <div>
          <label className="label">Campaign</label>
          <select name="campaignId" className="input">
            <option value="">- Unassigned -</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.client.businessName} - {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Format</label>
          <select name="format" className="input">
            <option>IMAGE</option><option>VIDEO</option><option>CAROUSEL</option>
            <option>STORY</option><option>REEL</option><option>TEXT</option><option>UGC</option>
          </select>
        </div>
        <div>
          <label className="label">Platform</label>
          <select name="platform" className="input">
            {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Hook</label>
          <input name="hook" className="input" placeholder="First 3 seconds / opening line" />
        </div>
        <div>
          <label className="label">Headline</label>
          <input name="headline" className="input" placeholder="H1 / visible title" />
        </div>
        <div>
          <label className="label">CTA</label>
          <input name="cta" className="input" placeholder="Book Free Consultation" />
        </div>
        <div>
          <label className="label">Creator</label>
          <input name="creator" className="input" placeholder="Acme Founders" />
        </div>
        <div>
          <label className="label">Audience</label>
          <input name="audience" className="input" placeholder="HNI 35-55 Tier-1" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Primary copy</label>
          <textarea name="primaryCopy" rows={2} className="input" placeholder="Body copy..." />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button className="btn btn-primary">+ Add creative</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {creatives.map((c) => (
          <Link href={`/app/creatives/${c.id}`} key={c.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{c.name}</div>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <span className="badge badge-neutral">{c.format}</span>
              <span className="badge badge-brand">{PLATFORM_LABELS[c.platform as keyof typeof PLATFORM_LABELS] ?? c.platform}</span>
              {c.campaign && <span className="badge badge-accent">{c.campaign.client.businessName}</span>}
            </div>
            {c.hook && <div className="mt-3 text-sm text-ink-700 italic">"{c.hook}"</div>}
            {c.cta && <div className="mt-1 text-xs text-brand-600 font-semibold">{c.cta}</div>}
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink-500">
              <div><div className="font-medium text-ink-900 text-sm">{fmtNum(c.impressions)}</div>impressions</div>
              <div><div className="font-medium text-ink-900 text-sm">{fmtPct(c.ctr)}</div>CTR</div>
              <div><div className="font-medium text-ink-900 text-sm">{fmtNum(c.leads)}</div>leads</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">All creatives (table view)</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Format</th><th>Platform</th><th>Status</th><th className="text-right">Spend</th><th className="text-right">CTR</th><th className="text-right">CPL</th><th className="text-right">Conv.</th><th className="text-right">Revenue</th></tr></thead>
          <tbody>
            {creatives.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/app/creatives/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.name}</Link></td>
                <td>{c.format}</td>
                <td>{c.platform}</td>
                <td><StatusPill status={c.status} /></td>
                <td className="text-right font-mono text-xs">{fmtINR(c.spend)}</td>
                <td className="text-right font-mono text-xs">{fmtPct(c.ctr)}</td>
                <td className="text-right font-mono text-xs">{fmtINR(cpl(c.spend, c.leads))}</td>
                <td className="text-right font-mono text-xs">{fmtNum(c.conversions)}</td>
                <td className="text-right font-mono text-xs">{fmtINR(c.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value text-lg">{value}</div>
    </div>
  );
}