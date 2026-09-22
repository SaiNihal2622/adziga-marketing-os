// Adziga — /api/approvals
// List pending + recent decisions; create a new staged change.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ApprovalService } from "@/server/services/approval-service";
import { ForbiddenError, ValidationError } from "@/server/errors";

const createSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum(["update", "delete", "launch", "pause", "archive", "create"]),
  title: z.string().min(1).max(200),
  payload: z.record(z.unknown()).optional().nullable(),
  severity: z.enum(["critical", "important", "minor"]).optional(),
  reason: z.string().max(500).optional().nullable()
});

export const GET = authedRoute<{ status?: string; entityType?: string; severity?: string }>(
  null,
  async (ctx) => {
    return ApprovalService.list({
      orgId: ctx.orgId,
      status: (ctx.req.nextUrl.searchParams.get("status") as any) ?? undefined,
      entityType: ctx.req.nextUrl.searchParams.get("entityType") ?? undefined,
      severity: (ctx.req.nextUrl.searchParams.get("severity") as any) ?? undefined
    });
  }
);

export const POST = authedRoute<z.infer<typeof createSchema>>(
  createSchema,
  async (ctx, data) => {
    // Clients may stage their own requests; only Adziga admins may stage on behalf
    // of others. We rely on the role check at the auth layer; the orgId scope
    // is already enforced.
    const result = await ApprovalService.request({
      orgId: ctx.orgId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      title: data.title,
      payload: data.payload ?? null,
      requestedById: ctx.userId,
      requestedByKind: "user",
      severity: (data.severity as any) ?? ApprovalService.classify(data.entityType, data.payload ?? null),
      reason: data.reason ?? null
    });
    return result;
  }
);
