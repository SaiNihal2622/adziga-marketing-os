// Adziga — /api/admin/policies/preview
// Run the evaluator on a hypothetical change WITHOUT committing anything.
// Used by the policy editor UI to show "what would this do?" inline.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { PolicyEvaluator } from "@/server/services/policy-evaluator";

const previewSchema = z.object({
  entityType: z.enum(["Client", "Campaign", "AdSet", "Strategy", "Integration"]),
  entityId: z.string().min(1),
  action: z.enum(["update", "delete", "launch", "pause", "archive", "create"]),
  payload: z.record(z.unknown())
});

export const POST = authedRoute<z.infer<typeof previewSchema>>(
  previewSchema,
  async (ctx, data) => {
    const decision = await PolicyEvaluator.preview({
      orgId: ctx.orgId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      payload: data.payload as Record<string, unknown>
    });
    return { decision };
  }
);
