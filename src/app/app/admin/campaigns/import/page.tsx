// Adziga — /app/admin/campaigns/import
// Sprint 12a — admin UI for bulk CSV campaign import. Pastes CSV, dry-run preview, then submit.

import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { PageHeader } from "../../../_components/page-header";
import { Card } from "../../../_components/ui";
import { CampaignCsvImporter } from "./_importer";

export const dynamic = "force-dynamic";

export default async function CampaignImportPage() {
  await requireRole([Role.FOUNDER, Role.ADMIN]);
  const clients = await prisma.client.findMany({
    where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk campaign import"
        subtitle="Paste a CSV with campaigns to create them in batch. DRAFT status by default — review then launch individually."
        breadcrumbs={[
          { label: "Admin", href: "/app/admin" },
          { label: "Campaigns", href: "/app/admin/integrations" },
          { label: "Import" }
        ]}
      />

      <Card>
        <h3 className="text-sm font-semibold text-ink-700 mb-2">CSV format</h3>
        <pre className="text-[11px] font-mono bg-ink-50 p-3 rounded overflow-x-auto">
{`clientName,name,platform,objective,budget,startDate,endDate,externalId,notes
Acme Corp,Holiday Meta Ads,META,CONVERSIONS,50000,2026-09-23,2026-12-31,meta_12345,Q4 push
Acme Corp,Holiday Google Search,GOOGLE,LEADS,30000,2026-09-23,2026-12-31,google_67890,Q4 push
Globex,WhatsApp Catalog,WHATSAPP,TRAFFIC,5000,2026-09-23,2026-10-31,,Test campaign`}
        </pre>
        <p className="text-xs text-ink-500 mt-2">
          Required columns: clientName (must match an existing client exactly), name, platform (META|GOOGLE|YOUTUBE|INSTAGRAM|WHATSAPP|LINKEDIN|TWITTER|EMAIL|INFLUENCER|EVENT), objective, budget. Optional: startDate, endDate, externalId, notes. Available clients:
        </p>
        <ul className="text-xs text-ink-700 mt-1 flex flex-wrap gap-1">
          {clients.map((c) => (
            <li key={c.id} className="px-2 py-0.5 rounded bg-ink-50 font-mono">{c.businessName}</li>
          ))}
        </ul>
      </Card>

      <CampaignCsvImporter />
    </div>
  );
}
