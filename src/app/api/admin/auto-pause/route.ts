// Adziga — /api/admin/auto-pause
// Sprint 17b — manage the auto-pause policy. GET reads; PUT updates
// fields; POST runs an evaluation (respecting dryRun/disabled).

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { AutoPausePolicyService } from "@/server/services/auto-pause-policy";

export const GET = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  return { policy: await AutoPausePolicyService.getPolicy(ctx.orgId) };
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  consecutiveAnomalyDays: z.number().int().min(1).max(14).optional(),
  whitelistClientIds: z.array(z.string()).optional(),
  whitelistPlatforms: z.array(z.string()).optional(),
  maxPerRun: z.number().int().min(0).max(100).optional()
});

export const PUT = authedRoute<z.infer<typeof updateSchema>>(
  updateSchema,
  async (ctx, data) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    const policy = await AutoPausePolicyService.updatePolicy(ctx.orgId, data);
    return { policy };
  }
);

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  return AutoPausePolicyService.evaluate(ctx.orgId);
});
