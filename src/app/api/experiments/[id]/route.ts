// Adziga — /api/experiments/[id]
// Sprint 6 — A/B Experiments runner detail endpoint
//
// GET  /api/experiments/[id]   detail with variants + analysis
// POST /api/experiments/[id]   transition (start | complete | cancel)

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ExperimentService } from "@/server/services/experiment-service";

const TransitionBody = z.object({
  action: z.enum(["start", "complete", "cancel"]),
  conclusion: z.string().max(1000).optional()
});

export const GET = authedRoute(null, async (ctx, _body, params) => {
  const id = params.id;
  const exp = await ctx.prisma.experiment.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      client: true,
      campaign: true,
      variants: { orderBy: { id: "asc" } }
    }
  });
  if (!exp) return { error: "not found" } as any;

  const assignments = await ctx.prisma.experimentAssignment.findMany({
    where: { experimentId: id },
    select: { id: true, status: true, leadId: true, variantId: true, assignedAt: true }
  });

  let analysis = null as any;
  if (exp.status === "RUNNING" || exp.status === "COMPLETED") {
    try {
      analysis = await ExperimentService.analyze(ctx.prisma, id);
    } catch (e) {
      analysis = { error: String((e as Error).message ?? e) };
    }
  }

  return {
    experiment: exp,
    assignmentCount: assignments.length,
    analysis
  };
});

export const POST = authedRoute<z.infer<typeof TransitionBody>>(
  TransitionBody,
  async (ctx, body, params) => {
    const id = params.id;
    const exp = await ctx.prisma.experiment.findFirst({
      where: { id, orgId: ctx.orgId }
    });
    if (!exp) return { error: "not found" } as any;

    if (body.action === "start") {
      if (exp.status !== "PLANNED") return { error: `cannot start: experiment is ${exp.status}` } as any;

      // Make sure we have ≥ 2 variants before running.
      const variants = await ctx.prisma.experimentVariant.count({ where: { experimentId: id } });
      if (variants < 2) {
        return { error: "need at least 2 variants before starting" } as any;
      }
      const updated = await ctx.prisma.experiment.update({
        where: { id },
        data: { status: "RUNNING", startedAt: new Date() }
      });
      return { experiment: updated, ok: true };
    }

    if (body.action === "complete") {
      if (exp.status !== "RUNNING") return { error: `cannot complete: experiment is ${exp.status}` } as any;
      const result = await ExperimentService.completeExperiment(
        ctx.prisma,
        id,
        body.conclusion ?? ""
      );
      const updated = await ctx.prisma.experiment.findUnique({
        where: { id },
        include: { variants: { orderBy: { id: "asc" } } }
      });
      return { experiment: updated, ok: true, winnerVariantId: result.winnerVariantId };
    }

    if (body.action === "cancel") {
      if (exp.status === "COMPLETED") return { error: `cannot cancel completed experiment` } as any;
      const updated = await ctx.prisma.experiment.update({
        where: { id },
        data: { status: "CANCELLED", completedAt: new Date() }
      });
      return { experiment: updated, ok: true };
    }

    return { error: "unknown action" } as any;
  }
);
