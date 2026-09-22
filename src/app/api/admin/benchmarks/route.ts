// Adziga — /api/admin/benchmarks
// Sprint 14b — IndustryBenchmark CRUD (admin-only).

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

const Body = z.object({
  industry: z.string().min(1).max(80),
  objective: z.string().min(1).max(80),
  channel: z.string().min(1).max(40),
  cplMin: z.number().nonnegative(),
  cplMedian: z.number().nonnegative(),
  cplMax: z.number().nonnegative(),
  ctrMedian: z.number().min(0).max(1),
  convMedian: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
  region: z.string().min(1).max(8).default("IN")
});

export const GET = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const url = new URL(ctx.req.url);
  const industry = url.searchParams.get("industry") ?? undefined;
  const benchmarks = await prisma.industryBenchmark.findMany({
    where: industry ? { industry } : undefined,
    orderBy: [{ industry: "asc" }, { channel: "asc" }]
  });
  return { benchmarks };
});

export const POST = authedRoute<z.input<typeof Body>>(Body, async (ctx, body) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  if (body.cplMin > body.cplMedian || body.cplMedian > body.cplMax) {
    return { error: "cplMin ≤ cplMedian ≤ cplMax required" } as any;
  }
  const b = await prisma.industryBenchmark.upsert({
    where: {
      industry_objective_channel_region: {
        industry: body.industry,
        objective: body.objective,
        channel: body.channel,
        region: body.region ?? "IN"
      }
    },
    update: {
      cplMin: body.cplMin,
      cplMedian: body.cplMedian,
      cplMax: body.cplMax,
      ctrMedian: body.ctrMedian,
      convMedian: body.convMedian,
      sampleSize: body.sampleSize
    },
    create: body
  });
  return { benchmark: b };
});
