import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const main = async () => {
  const org = await p.organization.findFirst({ where: { slug: "adziga" } });
  const client = await p.client.findFirst({ where: { orgId: org.id } });
  const campaign = await p.campaign.findFirst({ where: { orgId: org.id } });
  const lead = await p.lead.findFirst({ where: { orgId: org.id } });
  const creative = await p.creative.findFirst({ where: { orgId: org.id } });
  const event = await p.marketingEvent.findFirst({ where: { orgId: org.id } });
  const strategy = await p.strategy.findFirst({ where: { orgId: org.id } });
  const report = await p.report.findFirst({ where: { orgId: org.id } });
  const exp = await p.experiment.findFirst({ where: { orgId: org.id } });
  const inf = await p.influencer.findFirst({ where: { orgId: org.id } });
  const request = await p.clientRequest.findFirst({ where: { orgId: org.id } });
  console.log("/app/clients/" + client.id);
  console.log("/app/campaigns/" + campaign.id);
  console.log("/app/leads/" + lead.id);
  console.log("/app/creatives/" + creative.id);
  console.log("/app/events/" + event.id);
  console.log("/app/strategy/" + strategy.id);
  console.log("/app/reports/" + report.id);
  console.log("/app/experiments/" + exp.id);
  console.log("/app/influencers/" + inf.id);
  console.log("/app/requests/" + request.id);
};
main().catch(e => console.error(e)).finally(() => p.$disconnect());