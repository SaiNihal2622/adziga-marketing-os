// Adziga — /api/admin/benchmarks/overrides
// Sprint 17c — manage per-org benchmark overrides. GET lists all;
// POST sets/replaces one override; DELETE removes one.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { OrgBenchmarkService } from "@/server/services/org-benchmark";

export const GET = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const overrides = await OrgBenchmarkService.listOverrides(ctx.orgId);
  return { overrides };
});

const fieldEnum = z.enum(["cplMin", "cplMedian", "cplMax", "ctrMedian", "convMedian"]);

const setSchema = z.object({
  industry: z.string().min(1).max(80),
  channel: z.string().min(1).max(40),
  field: fieldEnum,
  value: z.number().finite(),
  note: z.string().max(500).optional()
});

export const POST = authedRoute<z.infer<typeof setSchema>>(
  setSchema,
  async (ctx, data) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    const ov = await OrgBenchmarkService.setOverride(ctx.orgId, {
      ...data,
      updatedBy: ctx.userId
    });
    return { override: ov };
  }
);

const deleteSchema = z.object({
  industry: z.string().min(1).max(80),
  channel: z.string().min(1).max(40),
  field: fieldEnum
});

export const DELETE = authedRoute<z.infer<typeof deleteSchema>>(
  deleteSchema,
  async (ctx, data) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    const removed = await OrgBenchmarkService.clearOverride(ctx.orgId, data);
    return { removed };
  }
);
