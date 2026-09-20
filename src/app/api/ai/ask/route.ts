import { authedRoute } from "@/server/api";
import { askAssistantSchema } from "@/server/schemas";
import { prisma } from "@/lib/db";
import { cpl, roas } from "@/lib/format";
import { askAssistant } from "@/lib/ai";
import { runMMMForOrg, scoreAllLeadsForOrg } from "@/lib/analytics";

export const POST = authedRoute(askAssistantSchema, async (ctx, body) => {
  const where: any = { orgId: ctx.orgId };
  if (body.clientId) where.clientId = body.clientId;
  const campaigns = await prisma.campaign.findMany({ where });
  const clients = await prisma.client.findMany({
    where: { orgId: ctx.orgId, ...(body.clientId ? { id: body.clientId } : {}) }
  });
  const reports = await prisma.report.findMany({
    where: { orgId: ctx.orgId, ...(body.clientId ? { clientId: body.clientId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 3
  });

  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads), 0);
  const totalCustomers = campaigns.reduce((s, c) => s + Number(c.customers), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  // Pull deep analytics in parallel — they are read-only and isolated per org.
  const [mmm, leadScores] = await Promise.all([
    runMMMForOrg(ctx.orgId, 90).catch((e) => {
      console.error("mmm_failed", e);
      return undefined;
    }),
    scoreAllLeadsForOrg(ctx.orgId, 25).catch((e) => {
      console.error("lead_scoring_failed", e);
      return [];
    })
  ]);

  const result = await askAssistant({
    orgId: ctx.orgId,
    userId: ctx.userId,
    clientId: body.clientId,
    campaignIds: campaigns.map((c) => c.id),
    question: body.question,
    client: clients[0]
      ? { id: clients[0].id, businessName: clients[0].businessName, industry: clients[0].industry }
      : null,
    campaignStats: campaigns.slice(0, 20).map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      spend: c.spent,
      leads: Number(c.leads),
      cpl: c.spent / Math.max(1, Number(c.leads)),
      status: c.status
    })),
    kpis: {
      cpl: cpl(totalSpend, totalLeads),
      cac: totalCustomers ? totalSpend / totalCustomers : 0,
      roas: roas(totalRevenue, totalSpend),
      conversion: totalLeads ? (totalCustomers / totalLeads) * 100 : 0
    },
    reports: reports.map((r) => ({
      title: r.title,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      executiveSummary: r.executiveSummary
    })),
    mmm,
    leadScores
  });

  return {
    response: result.response,
    model: result.model,
    latencyMs: result.latencyMs,
    analyticsUsed: { mmm: Boolean(mmm), leadScores: leadScores.length }
  };
});