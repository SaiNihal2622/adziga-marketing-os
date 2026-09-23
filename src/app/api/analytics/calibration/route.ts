// Adziga — /api/analytics/calibration
// Sprint 18a — read or recompute the predictive-model calibration snapshot.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { CalibrationService } from "@/server/services/calibration-service";

export const GET = authedRoute(null, async (ctx) => {
  return CalibrationService.lastSnapshot(ctx.orgId);
});

const body = z.object({ days: z.number().int().min(7).max(365).optional() });

export const POST = authedRoute<z.infer<typeof body>>(
  body,
  async (ctx, data) => {
    return CalibrationService.check(ctx.orgId, data?.days);
  }
);
