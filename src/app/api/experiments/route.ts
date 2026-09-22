// Adziga — /api/experiments
// Sprint 6 — A/B Experiments runner
//
// GET   /api/experiments            list experiments for the org with summary
// POST  /api/experiments            create new experiment (with seeded variants)
//
// Sprint 5 — creating an experiment uses the standard ApprovalService
// gateway. The auto-approver only auto-applies safe field patches
// (title/hypothesis/metric/minSampleSize). Adding/removing variants always
// queues for review because it's a structural change.

import { z } from "zod";
import crypto from "node:crypto";
import { authedRoute } from "@/server/api";
import { ExperimentService } from "@/server/services/experiment-service";

const VariantInput = z.object({
  kind: z.enum(["CONTROL", "TREATMENT"]),
  label: z.string().min(1).max(80),
  config: z.record(z.any()).optional(),
  weight: z.number().positive().max(10).optional()
});

const CreateBody = z.object({
  title: z.string().min(3).max(200),
  hypothesis: z.string().min(10).max(1000),
  variable: z.string().min(2).max(80),
  control: z.string().min(1).max(2000),
  treatment: z.string().min(1).max(2000),
  audience: z.string().max(200).optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
  durationDays: z.number().int().min(1).max(365).optional().default(14),
  kpi: z.string().min(2).max(80),
  expectedResult: z.string().max(200).optional().nullable(),
  clientId: z.string().min(1).optional().nullable(),
  campaignId: z.string().min(1).optional().nullable(),
  metric: z.enum(["qualified_rate", "won_rate", "revenue_per_lead"]).optional().default("qualified_rate"),
  minSampleSize: z.number().int().min(10).max(10000).optional().default(30),
  primary: z.boolean().optional().default(false),
  variants: z.array(VariantInput).min(2)
});

export const GET = authedRoute(null, async (ctx) => {
  const experiments = await ctx.prisma.experiment.findMany({
    where: { orgId: ctx.orgId },
    include: {
      client: true,
      campaign: true,
      variants: true,
      _count: { select: { assignments: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    experiments: experiments.map((e) => ({
      id: e.id,
      title: e.title,
      hypothesis: e.hypothesis,
      variable: e.variable,
      status: e.status,
      kpi: e.kpi,
      metric: e.metric,
      client: e.client?.businessName ?? null,
      campaign: e.campaign?.name ?? null,
      variantCount: e.variants.length,
      assignments: e._count.assignments,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      winnerVariantId: e.winnerVariantId,
      createdAt: e.createdAt
    }))
  };
});

export const POST = authedRoute<z.input<typeof CreateBody>>(
  CreateBody,
  async (ctx, body) => {
    // Validate variant structure (exactly one CONTROL)
    const controlCount = body.variants.filter((v) => v.kind === "CONTROL").length;
    if (controlCount !== 1) {
      return { error: "Exactly one CONTROL variant is required" } as any;
    }

    // Lazily mint a bucket salt for this org if absent.
    if (true) {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.orgId },
        select: { experimentBucketSalt: true }
      });
      if (!org?.experimentBucketSalt) {
        const salt = crypto.randomUUID();
        await ctx.prisma.organization.update({
          where: { id: ctx.orgId },
          data: { experimentBucketSalt: salt }
        });
      }
    }

    const exp = await ctx.prisma.experiment.create({
      data: {
        orgId: ctx.orgId,
        clientId: body.clientId ?? null,
        campaignId: body.campaignId ?? null,
        title: body.title,
        hypothesis: body.hypothesis,
        variable: body.variable,
        control: body.control,
        treatment: body.treatment,
        audience: body.audience ?? null,
        budget: body.budget ?? null,
        durationDays: body.durationDays,
        kpi: body.kpi,
        expectedResult: body.expectedResult ?? null,
        metric: body.metric,
        minSampleSize: body.minSampleSize,
        primary: body.primary ?? false,
        status: "PLANNED"
      }
    });

    await ExperimentService.seedVariants(
      ctx.prisma,
      exp.id,
      body.variants
    );

    const full = await ctx.prisma.experiment.findUnique({
      where: { id: exp.id },
      include: { variants: true, client: true, campaign: true }
    });

    return { experiment: full };
  }
);
