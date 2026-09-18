import { authedRoute } from "@/server/api";
import { leadScoringSchema } from "@/server/schemas";
import { LeadService } from "@/server/services/lead-service";
import { prisma } from "@/lib/db";

export const POST = authedRoute(leadScoringSchema, async (ctx, body) => {
  const where: any = { orgId: ctx.orgId };
  if (body.unscoredOnly) where.score = 0;
  if (body.clientId) where.clientId = body.clientId;

  const leads = await prisma.lead.findMany({ where, take: 200 });
  const results: Array<{ id: string; score: number }> = [];

  for (const l of leads) {
    try {
      const r = await LeadService.scoreAndAssign(ctx.orgId, ctx.userId, l.id);
      results.push(r);
    } catch (e) {
      // continue
    }
  }

  return { scored: results.length, results };
});

export const GET = authedRoute(null, async () => {
  const scores = await prisma.leadScore.findMany({
    orderBy: { computedAt: "desc" },
    take: 50
  });
  return scores;
});