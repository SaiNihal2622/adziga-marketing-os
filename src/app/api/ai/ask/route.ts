import { authedRoute } from "@/server/api";
import { askAssistantSchema } from "@/server/schemas";
import { prisma } from "@/lib/db";
import { cpl, roas } from "@/lib/format";
import { askAssistant } from "@/lib/ai";
import { runMMMForOrg, scoreAllLeadsForOrg, computeAttributionBatch } from "@/lib/analytics";
import type { AttributionInput } from "@/lib/analytics";

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
  // MMM and lead scoring are pre-baked; attribution needs raw lead → touchpoint
  // reconstruction so we run it inline from the same Lead query used elsewhere.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);
  const [mmm, leadScores, leadsForAttribution] = await Promise.all([
    runMMMForOrg(ctx.orgId, 90).catch((e) => {
      console.error("mmm_failed", e);
      return undefined;
    }),
    scoreAllLeadsForOrg(ctx.orgId, 25).catch((e) => {
      console.error("lead_scoring_failed", e);
      return [];
    }),
    prisma.lead
      .findMany({
        where: { orgId: ctx.orgId, createdAt: { gte: ninetyDaysAgo } },
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          source: true,
          campaignId: true,
          createdAt: true,
          updatedAt: true
        }
      })
      .catch((e) => {
        console.error("attribution_query_failed", e);
        return [];
      })
  ]);

  // Build attribution inputs from leads (same shape as the analytics endpoint).
  const attributionInputs: AttributionInput[] = leadsForAttribution.map((lead) => {
    const touchpoints = [
      {
        channel: ((lead.source || "OTHER").toUpperCase()) as any,
        campaignId: lead.campaignId ?? undefined,
        occurredAt: lead.createdAt.toISOString()
      }
    ];
    if (lead.updatedAt.getTime() - lead.createdAt.getTime() > 60_000) {
      touchpoints.push({
        channel: "DIRECT" as any,
        campaignId: undefined,
        occurredAt: lead.updatedAt.toISOString()
      });
    }
    return { leadId: lead.id, touchpoints, converted: lead.status === "WON" };
  });

  let attribution: { leadsAnalyzed: number; channelTotals: Record<string, number> } | undefined;
  if (attributionInputs.length) {
    try {
      const results = await computeAttributionBatch(attributionInputs);
      const totals: Record<string, number> = {};
      for (const r of results) {
        for (const [ch, credit] of Object.entries(r.channelCredits as Record<string, number>)) {
          totals[ch] = (totals[ch] ?? 0) + credit;
        }
      }
      attribution = { leadsAnalyzed: results.length, channelTotals: totals };
    } catch (e) {
      console.error("attribution_compute_failed", e);
    }
  }

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
    leadScores,
    attribution
  });

  return {
    response: result.response,
    model: result.model,
    latencyMs: result.latencyMs,
    analyticsUsed: {
      mmm: Boolean(mmm),
      leadScores: leadScores.length,
      attribution: attribution?.leadsAnalyzed ?? 0
    }
  };
});