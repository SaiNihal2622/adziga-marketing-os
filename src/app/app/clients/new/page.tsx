import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

async function createClient(formData: FormData) {
  "use server";
  const session = await requireSession();
  const businessName = String(formData.get("businessName") ?? "").trim();
  if (!businessName) return;
  const c = await prisma.client.create({
    data: {
      orgId: session.orgId,
      businessName,
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? "") || null,
      industry: String(formData.get("industry") ?? "") || null,
      websiteUrl: String(formData.get("websiteUrl") ?? "") || null,
      city: String(formData.get("city") ?? "") || null,
      monthlyBudget: Number(formData.get("monthlyBudget") ?? 0) || 0,
      status: "ACTIVE",
      tier: "PRO",
      contractStart: new Date()
    }
  });
  redirect(`/app/clients/${c.id}`);
}

export default async function NewClientPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New client"
        subtitle="Create a new client account. The full onboarding wizard lives at /onboarding."
        breadcrumbs={[{ label: "Clients", href: "/app/clients" }, { label: "New" }]}
      />
      <form action={createClient} className="card p-6 space-y-4 max-w-2xl">
        <div>
          <label className="label">Business name *</label>
          <input name="businessName" required className="input" placeholder="Acme Realty" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Contact name</label>
            <input name="contactName" className="input" placeholder="Rohan Mehta" />
          </div>
          <div>
            <label className="label">Contact email</label>
            <input name="contactEmail" type="email" className="input" placeholder="rohan@example.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="contactPhone" className="input" placeholder="+91 ..." />
          </div>
          <div>
            <label className="label">Industry</label>
            <input name="industry" className="input" placeholder="Real Estate" />
          </div>
          <div>
            <label className="label">City</label>
            <input name="city" className="input" placeholder="Mumbai" />
          </div>
          <div>
            <label className="label">Website</label>
            <input name="websiteUrl" className="input" placeholder="https://..." />
          </div>
          <div>
            <label className="label">Monthly budget (₹)</label>
            <input name="monthlyBudget" type="number" className="input" placeholder="100000" />
          </div>
        </div>
        <div className="pt-4 border-t border-ink-100 flex justify-end gap-2">
          <a href="/app/clients" className="btn btn-ghost">Cancel</a>
          <button type="submit" className="btn btn-primary">Create client</button>
        </div>
      </form>
    </div>
  );
}