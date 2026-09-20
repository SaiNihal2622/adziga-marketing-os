import { z } from "zod";
import { authedRoute } from "@/server/api";
import { prisma } from "@/lib/db";
import { computeAttributionBatch } from "@/lib/analytics";
import type { Touchpoint, AttributionInput } from "@/lib/analytics";

const schema = z.object({
  leadIds: z.array(z.string()).min(1).max(500).optional(),
  days: z.number().int().min(7).max(365).optional()
});

/**
 * Multi-touch attribution endpoint.
 * Pulls Lead → campaign interactions → builds touchpoints → Shapley values.
 */
export const POST = authedRoute(schema, async (ctx, body) => {
  const days = body.days ?? 90;
  const since = new Date(Date.now() - days * 86400_000);

  // Find leads for this org
  const where: any = { orgId: ctx.orgId, createdAt: { gte: since } };
  if (body.leadIds?.length) where.id = { in: body.leadIds };

  const leads = await prisma.lead.findMany({
    where,
    take: 200,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      // We approximate "touchpoints" as: lead source + any campaign associations
      source: true,
      campaignId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const inputs: AttributionInput[] = leads.map((lead) => {
    const touchpoints: Touchpoint[] = [];
    // Source channel counts as first touch
    touchpoints.push({
      channel: ((lead.source || "OTHER").toUpperCase() as any),
      campaignId: lead.campaignId ?? undefined,
      occurredAt: lead.createdAt.toISOString()
    });
    // Last activity as a second touch (if status changed)
    if (lead.updatedAt.getTime() - lead.createdAt.getTime() > 60_000) {
      touchpoints.push({
        channel: "DIRECT", // last-touch attribution typically gets direct/organic
        campaignId: undefined,
        occurredAt: lead.updatedAt.toISOString()
      });
    }
    return {
      leadId: lead.id,
      touchpoints,
      converted: lead.status === "WON"
    };
  });

  const results = computeAttributionBatch(inputs);

  // Aggregate channel credits across all leads
  const totals: Record<string, number> = {};
  for (const r of results) {
    for (const [ch, credit] of Object.entries(r.channelCredits)) {
      totals[ch] = (totals[ch] ?? 0) + credit;
    }
  }

  return {
    leadsAnalyzed: results.length,
    channelTotals: totals,
    perLead: results.slice(0, 50)
  };
});
