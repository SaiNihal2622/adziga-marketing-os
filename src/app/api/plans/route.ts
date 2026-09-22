// Adziga — /api/plans
// Sprint 13a — multi-step plan orchestrator endpoint.
// POST to create + execute a plan in one call. GET to list.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { PlanOrchestrator } from "@/server/services/plan-orchestrator";

const Body = z.object({
  prompt: z.string().min(1).max(2000),
  clientId: z.string().optional(),
  industry: z.string().optional(),
  channels: z
    .array(
      z.object({
        platform: z.string().min(1).max(40),
        totalBudget: z.number().nonnegative()
      })
    )
    .min(1)
    .max(8),
  totalBudget: z.number().nonnegative().optional()
});

export const POST = authedRoute<z.input<typeof Body>>(Body, async (ctx, body) => {
  const { planId } = await PlanOrchestrator.createPlan({
    orgId: ctx.orgId,
    createdById: ctx.userId,
    prompt: body.prompt,
    clientId: body.clientId,
    industry: body.industry,
    channels: body.channels,
    totalBudget: body.totalBudget
  });
  const finalState = await PlanOrchestrator.executePlan(planId);
  return { plan: finalState };
});

export const GET = authedRoute(null, async (ctx) => {
  const plans = await ctx.prisma.orchestrationPlan.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  return {
    plans: plans.map((p) => ({
      id: p.id,
      prompt: p.strategy,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null
    }))
  };
});
