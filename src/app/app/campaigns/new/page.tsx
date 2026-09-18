import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "../../_components/page-header";
import { PLATFORM_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function createCampaign(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const platform = String(formData.get("platform") ?? "META");
  if (!name || !clientId) return;
  const c = await prisma.campaign.create({
    data: {
      orgId: session.orgId,
      name,
      clientId,
      platform,
      objective: String(formData.get("objective") ?? "Lead generation"),
      budget: Number(formData.get("budget") ?? 0) || 0,
      status: "DRAFT",
      startDate: new Date(),
      utmSource: platform === "META" ? "meta" : platform === "GOOGLE" ? "google" : platform.toLowerCase(),
      utmMedium: "paid",
      utmCampaign: name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    }
  });
  await audit(session.orgId, session.userId, "campaign.create", {
    entityType: "Campaign",
    entityId: c.id,
    after: { name, platform, budget: c.budget }
  });
  redirect(`/app/campaigns/${c.id}`);
}

export default async function NewCampaignPage() {
  const session = await requireSession();
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        subtitle="Start as a Draft and move it through the workflow."
        breadcrumbs={[{ label: "Campaigns", href: "/app/campaigns" }, { label: "New" }]}
      />
      <form action={createCampaign} className="card p-6 space-y-4 max-w-2xl">
        <div>
          <label className="label">Campaign name *</label>
          <input name="name" required className="input" placeholder="Acme - Dubai Investor Acquisition (Meta)" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client *</label>
            <select name="clientId" required className="input">
              <option value="">Select a client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Platform *</label>
            <select name="platform" required className="input">
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Objective</label>
            <select name="objective" className="input">
              <option>Awareness</option>
              <option>Lead generation</option>
              <option>Conversion</option>
              <option>Engagement</option>
              <option>Traffic</option>
            </select>
          </div>
          <div>
            <label className="label">Budget ()</label>
            <input name="budget" type="number" className="input" placeholder="100000" />
          </div>
        </div>
        <div className="pt-4 border-t border-ink-100 flex justify-end gap-2">
          <a href="/app/campaigns" className="btn btn-ghost">Cancel</a>
          <button type="submit" className="btn btn-primary">Create draft</button>
        </div>
      </form>
    </div>
  );
}