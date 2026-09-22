#!/usr/bin/env node
// Adziga — Backfill attribution data for legacy rows.
// Idempotent. Run once after deploying the LeadTouch + Customer.acquiredCampaignId schema.
//
// What it does:
//   1. For every Customer row that has a leadId but no acquiredCampaignId, copy
//      Lead.campaignId into Customer.acquiredCampaignId.
//   2. For every Lead with status=WON and no convertedAt, set convertedAt = wonAt.
//   3. Backfill a single LeadTouch row per converted lead so the multi-touch
//      attribution journey is at least non-empty for old data.
//
// Usage:
//   node scripts/backfill-attribution.mjs            # processes all orgs
//   DATABASE_URL=... node scripts/backfill-attribution.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Backfilling Customer.acquiredCampaignId from Lead.campaignId …");
  const customers = await prisma.customer.findMany({
    where: { leadId: { not: null }, acquiredCampaignId: null },
    include: { lead: { select: { campaignId: true } } }
  });
  let custUpdates = 0;
  for (const c of customers) {
    if (c.lead?.campaignId) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { acquiredCampaignId: c.lead.campaignId }
      });
      custUpdates++;
    }
  }
  console.log(`  Updated ${custUpdates} customer(s).`);

  console.log("Backfilling Lead.convertedAt from Lead.wonAt …");
  const leads = await prisma.lead.findMany({
    where: { status: "WON", convertedAt: null, wonAt: { not: null } },
    select: { id: true, wonAt: true }
  });
  for (const l of leads) {
    await prisma.lead.update({
      where: { id: l.id },
      data: { convertedAt: l.wonAt }
    });
  }
  console.log(`  Updated ${leads.length} lead(s).`);

  console.log("Backfilling LeadTouch rows for converted leads …");
  const convertedLeads = await prisma.lead.findMany({
    where: { status: "WON", campaignId: { not: null } },
    select: { id: true, orgId: true, campaignId: true, convertedAt: true }
  });
  let touchInserts = 0;
  for (const l of convertedLeads) {
    if (!l.campaignId) continue;
    const exists = await prisma.leadTouch.findFirst({
      where: { leadId: l.id, campaignId: l.campaignId, touchType: "QUALIFICATION" }
    });
    if (!exists) {
      await prisma.leadTouch.create({
        data: {
          orgId: l.orgId,
          leadId: l.id,
          campaignId: l.campaignId,
          touchType: "QUALIFICATION",
          touchedAt: l.convertedAt ?? new Date(),
          metadata: JSON.stringify({ kind: "conversion", backfilled: true })
        }
      });
      touchInserts++;
    }
  }
  console.log(`  Inserted ${touchInserts} touchpoint(s).`);

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
