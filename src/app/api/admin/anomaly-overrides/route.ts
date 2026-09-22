// Adziga — /api/admin/anomaly-overrides
// Sprint 12d — read/write per-org anomaly-detection thresholds.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

const Body = z.object({
  sigmaThreshold: z.number().min(1).max(5).optional(),
  industryCeilingMultiplier: z.number().min(0.1).max(2).optional()
});

export const GET = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { metadata: true }
  });
  let overrides = { sigmaThreshold: 2.5, industryCeilingMultiplier: 0.8 };
  if (org?.metadata) {
    try {
      const meta = JSON.parse(org.metadata) as Record<string, unknown>;
      if (meta.anomalyOverrides) overrides = { ...overrides, ...(meta.anomalyOverrides as object) };
    } catch {
      /* malformed */
    }
  }
  return { overrides, defaults: { sigmaThreshold: 2.5, industryCeilingMultiplier: 0.8 } };
});

export const POST = authedRoute<z.input<typeof Body>>(Body, async (ctx, body) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { metadata: true }
  });
  const meta: Record<string, unknown> = org?.metadata ? JSON.parse(org.metadata) : {};
  meta.anomalyOverrides = {
    sigmaThreshold: body.sigmaThreshold ?? 2.5,
    industryCeilingMultiplier: body.industryCeilingMultiplier ?? 0.8
  };
  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: { metadata: JSON.stringify(meta) }
  });
  return { overrides: meta.anomalyOverrides };
});
