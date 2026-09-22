// scripts/reprovision-agents.mjs — re-create default agents for every org
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const p = new PrismaClient();

const AGENT_TEMPLATES = [
  { role: "STRATEGY",          name: "Strategy Agent",          permissions: "analytics.read,budget.read,strategy.write,campaign.create,client.create", tools: "client.create,campaign.create,budget.allocate,analytics.mmm,analytics.attribution",        trigger: "manual" },
  { role: "AD_OPS",            name: "Ad Ops Agent",            permissions: "analytics.read,budget.read,campaign.*", tools: "campaign.create,campaign.pause,campaign.adjust_budget,analytics.attribution,analytics.mmm", trigger: "manual" },
  { role: "CONTENT",           name: "Content Agent",           permissions: "creative.create,briefs.write,analytics.read", tools: "creative.create,creative.generateCopy,creative.generateImage,brief.create,analytics.attribution", trigger: "manual" },
  { role: "WHATSAPP",          name: "WhatsApp Agent",          permissions: "contacts:*", tools: "whatsapp.send_broadcast,whatsapp.send_template,analytics.attribution", trigger: "manual" },
  { role: "INFLUENCER",        name: "Influencer Agent",        permissions: "influencers:*", tools: "influencer.search,influencer.outreach,influencer.contract", trigger: "manual" },
  { role: "REPORTING",         name: "Reporting Agent",         permissions: "reports:read,analytics:read", tools: "report.generate,analytics.mmm,analytics.attribution", trigger: "cron" },
  { role: "COMPETITOR_RESEARCH", name: "Competitor Agent",      permissions: "competitors:*", tools: "competitor.search_ads,competitor.summarize_creative,competitor.compare", trigger: "cron" },
  { role: "SUPPORT",           name: "Support Agent",           permissions: "support:reply,clients:read", tools: "support.reply,support.escalate", trigger: "manual" }
];

async function provision(orgId) {
  const existing = await p.agent.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`orgId=${orgId}: ${existing} agents already exist, skipping`);
    return;
  }
  for (const t of AGENT_TEMPLATES) {
    await p.agent.create({
      data: {
        orgId,
        role: t.role,
        name: t.name,
        permissions: t.permissions,
        tools: t.tools,
        trigger: t.trigger,
        enabled: true,
        totalRuns: 0,
        systemPrompt: "" // populated lazily by the runner's buildSystemPrompt
      }
    });
    console.log(`orgId=${orgId}: created ${t.role}`);
  }
}

const orgs = await p.organization.findMany({ select: { id: true, name: true } });
console.log(`Found ${orgs.length} orgs`);
for (const o of orgs) {
  await provision(o.id);
}

await p.$disconnect();
