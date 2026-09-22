// Adziga — /api/admin/policies
// Manage the org's AutoApprove policies.
//   GET    — list policies
//   PUT    — replace the full policy list
//   POST   — upsert a single policy by id (creates if id absent)

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { ApprovalService } from "@/server/services/approval-service";
import { PolicyEntityType, PolicyAction } from "@/server/services/policy-types";

const fieldConstraintSchema = z.object({
  field: z.string().min(1).max(80),
  maxDelta: z.number().nonnegative().optional(),
  maxRelativeChange: z.number().min(0).max(1).optional(),
  allowedValues: z.array(z.string()).optional(),
  mustEqual: z.union([z.boolean(), z.string(), z.number()]).optional(),
  pattern: z.string().max(200).optional()
});

const capsSchema = z.object({
  maxPerDay: z.number().int().nonnegative().optional(),
  maxPerMonth: z.number().int().nonnegative().optional(),
  dryRun: z.boolean().optional(),
  pauseAfterHour: z.number().int().min(0).max(23).optional(),
  requireConfirmationWithinMinutes: z.number().int().nonnegative().optional()
});

const policySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  entityType: z.enum(["Client", "Campaign", "AdSet", "Strategy", "Integration"]),
  action: z.enum(["update", "delete", "launch", "pause", "archive", "create"]),
  fieldConstraints: z.array(fieldConstraintSchema).max(20),
  caps: capsSchema,
  enabled: z.boolean()
});

const policyListSchema = z.object({
  policies: z.array(policySchema).max(50)
});

const policyUpsertSchema = policySchema.extend({
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdById: z.string().optional()
});

export const GET = authedRoute(null, async (ctx) => {
  const policies = await ApprovalService.listPolicies(ctx.orgId);
  const { PREBUILT_POLICIES } = await import("@/server/services/policy-library");
  return { policies, library: PREBUILT_POLICIES };
});

export const PUT = authedRoute<z.infer<typeof policyListSchema>>(
  policyListSchema,
  async (ctx, data) => {
    return { policies: await ApprovalService.setPolicies(ctx.orgId, data.policies as any, ctx.userId) };
  }
);

export const POST = authedRoute<z.infer<typeof policyUpsertSchema>>(
  policyUpsertSchema,
  async (ctx, data) => {
    const policy = await ApprovalService.upsertPolicy(ctx.orgId, data as any, ctx.userId);
    return { policy };
  }
);

export const DELETE = authedRoute<{ policyId: string }>(
  z.object({ policyId: z.string().min(1) }),
  async (ctx, data) => {
    return ApprovalService.deletePolicy(ctx.orgId, data.policyId, ctx.userId);
  }
);
