// GET /api/agents/agents — list agents in the org (with their threads)

import { authedRoute } from "@/server/api";

export const dynamic = "force-dynamic";

export const GET = authedRoute({} as any, async (ctx) => {
  const agents = await ctx.prisma.agent.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      description: true,
      permissions: true,
      tools: true,
      trigger: true,
      cronExpr: true,
      triggerEvent: true,
      enabled: true,
      totalRuns: true,
      lastRunAt: true,
      lastError: true,
      clientId: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return { agents };
});
