import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

async function createLead(formData: FormData) {
  "use server";
  const session = await requireSession();
  const l = await prisma.lead.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? ""),
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      name: String(formData.get("name") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      city: String(formData.get("city") ?? "") || null,
      source: String(formData.get("source") ?? "DIRECT"),
      utmSource: String(formData.get("utmSource") ?? "") || null,
      utmMedium: String(formData.get("utmMedium") ?? "") || null,
      utmCampaign: String(formData.get("utmCampaign") ?? "") || null,
      utmContent: String(formData.get("utmContent") ?? "") || null,
      clickId: String(formData.get("clickId") ?? "") || null,
      landingPage: String(formData.get("landingPage") ?? "") || null,
      score: Number(formData.get("score") ?? 0),
      status: "NEW"
    }
  });
  await audit(session.orgId, session.userId, "lead.create", { entityType: "Lead", entityId: l.id, after: { source: l.source } });
  redirect(`/app/leads/${l.id}`);
}

export default async function NewLeadPage() {
  const session = await requireSession();
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });
  const campaigns = await prisma.campaign.findMany({ where: { orgId: session.orgId }, include: { client: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New lead"
        subtitle="Manually add a lead to the system with full attribution context."
        breadcrumbs={[{ label: "Leads", href: "/app/leads" }, { label: "New" }]}
      />
      <form action={createLead} className="card p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" placeholder="+91 ..." />
          </div>
          <div>
            <label className="label">City</label>
            <input name="city" className="input" />
          </div>
          <div>
            <label className="label">Client *</label>
            <select name="clientId" required className="input">
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Source *</label>
            <select name="source" required className="input">
              <option value="DIRECT">Direct</option>
              <option value="META_AD">Meta Ad</option>
              <option value="GOOGLE_AD">Google Ad</option>
              <option value="ORGANIC">Organic</option>
              <option value="REFERRAL">Referral</option>
              <option value="INFLUENCER">Influencer</option>
              <option value="EVENT">Event</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Campaign (optional)</label>
            <select name="campaignId" className="input">
              <option value="">— None —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.client.businessName} · {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">UTM Source</label>
            <input name="utmSource" className="input" placeholder="meta" />
          </div>
          <div>
            <label className="label">UTM Medium</label>
            <input name="utmMedium" className="input" placeholder="paid" />
          </div>
          <div>
            <label className="label">UTM Campaign</label>
            <input name="utmCampaign" className="input" />
          </div>
          <div>
            <label className="label">UTM Content</label>
            <input name="utmContent" className="input" />
          </div>
          <div>
            <label className="label">Click ID</label>
            <input name="clickId" className="input" placeholder="fbclid / gclid" />
          </div>
          <div>
            <label className="label">Landing page</label>
            <input name="landingPage" type="url" className="input" />
          </div>
          <div>
            <label className="label">Score (0-100)</label>
            <input name="score" type="number" defaultValue={50} min={0} max={100} className="input" />
          </div>
        </div>
        <div className="pt-4 border-t border-ink-100 flex justify-end gap-2">
          <a href="/app/leads" className="btn btn-ghost">Cancel</a>
          <button className="btn btn-primary">Create lead</button>
        </div>
      </form>
    </div>
  );
}