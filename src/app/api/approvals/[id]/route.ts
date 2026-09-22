// Adziga — /api/approvals/[id]
// Get one approval; decide it (approve/reject applies the payload); cancel.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ApprovalService } from "@/server/services/approval-service";

export const GET = authedRoute(
  null,
  async (ctx, _data, params) => {
    return ApprovalService.get(ctx.orgId, params.id);
  }
);

const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().max(1000).optional().nullable()
});

export const POST = authedRoute<z.infer<typeof decideSchema>>(
  decideSchema,
  async (ctx, data, params) => {
    return ApprovalService.decide({
      orgId: ctx.orgId,
      approvalId: params.id,
      approverId: ctx.userId,
      decision: data.decision,
      notes: data.notes ?? null
    });
  }
);

const cancelSchema = z.object({}).optional();

export const DELETE = authedRoute(
  cancelSchema,
  async (ctx, _data, params) => {
    return ApprovalService.cancel(ctx.orgId, params.id, ctx.userId);
  }
);
