// Adziga — /api/admin/agents/cost
// Sprint 18c — read the agent-cost snapshot, persist alerts, update policy.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { AgentCostAlertService } from "@/server/services/agent-cost";

export const GET = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  return AgentCostAlertService.snapshot(ctx.orgId);
});

const policySchema = z.object({
  dailyLimit: z.number().finite().min(0).optional(),
  weeklyLimit: z.number().finite().min(0).optional(),
  enabled: z.boolean().optional()
});

export const PUT = authedRoute<z.infer<typeof policySchema>>(
  policySchema,
  async (ctx, data) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    return { policy: await AgentCostAlertService.updatePolicy(ctx.orgId, data) };
  }
);

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  return AgentCostAlertService.check(ctx.orgId);
});
