import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const counts = {
    organizations: await p.organization.count(),
    users: await p.user.count(),
    orgMembers: await p.orgMember.count(),
    clients: await p.client.count(),
    strategies: await p.strategy.count(),
    campaigns: await p.campaign.count(),
    adSets: await p.adSet.count(),
    ads: await p.ad.count(),
    creatives: await p.creative.count(),
    audiences: await p.audience.count(),
    leads: await p.lead.count(),
    customers: await p.customer.count(),
    revenue: await p.revenue.count(),
    adSpend: await p.adSpend.count(),
    events: await p.marketingEvent.count(),
    registrations: await p.registration.count(),
    influencers: await p.influencer.count(),
    experiments: await p.experiment.count(),
    decisions: await p.decisionLog.count(),
    reports: await p.report.count(),
    requests: await p.clientRequest.count(),
    tasks: await p.task.count(),
    notifications: await p.notification.count(),
    automations: await p.automation.count(),
    integrations: await p.integration.count(),
    auditLogs: await p.auditLog.count(),
    aiInteractions: await p.aIInteraction.count(),
    billingAccounts: await p.billingAccount.count(),
    invoices: await p.invoice.count()
  };
  for (const [k, v] of Object.entries(counts)) {
    console.log(`${k.padEnd(20)} ${v}`);
  }
}
main().catch(e => console.error(e)).finally(() => p.$disconnect());