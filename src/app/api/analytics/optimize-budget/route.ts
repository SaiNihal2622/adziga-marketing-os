// Adziga — /api/analytics/optimize-budget
// Value-based budget allocator. Replaces naive Thompson sampling —
// weights channels by their value-per-rupee (revenue or predicted revenue
// from qualified rate × customer rate × avg deal size) instead of CPL alone.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { AttributionService } from "@/server/services/attribution-service";

const schema = z.object({
  totalBudget: z.number().min(0),
  days: z.number().int().min(7).max(180).optional(),
  clientId: z.string().min(1).optional()
});

export const POST = authedRoute<z.infer<typeof schema>>(
  schema,
  async (ctx, body) => {
    return AttributionService.valueBasedAllocate(ctx.orgId, {
      totalBudget: body.totalBudget,
      clientId: body.clientId,
      since: new Date(Date.now() - (body.days ?? 60) * 86_400_000)
    });
  }
);

export const GET = authedRoute(null, async (ctx) => {
  const url = ctx.req.nextUrl;
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const totalBudget = Number(url.searchParams.get("budget") ?? "0");
  return AttributionService.valueBasedAllocate(ctx.orgId, { clientId, totalBudget });
});
