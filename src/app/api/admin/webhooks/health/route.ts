// Adziga — /api/admin/webhooks/health
// Sprint 17a — run the webhook health check, return the snapshot, and
// persist raised alerts to Organization.metadata. Also exposes the
// stored alert history.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { WebhookHealthService } from "@/server/services/webhook-health";

const body = z.object({}).optional();

export const GET = authedRoute(
  null,
  async (ctx) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    const stored = await WebhookHealthService.loadStoredAlerts(ctx.orgId);
    return { alerts: stored };
  }
);

export const POST = authedRoute<z.infer<typeof body>>(
  body.optional(),
  async (ctx, _data) => {
    if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
      return { error: "FOUNDER or ADMIN required" } as any;
    }
    return WebhookHealthService.check(ctx.orgId);
  }
);
