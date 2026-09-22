// Adziga — /api/admin/policy-library/instantiate
// Sprint 7c — copy a prebuilt policy into this org's policy list.
// Admins opt into templates from the auto-approve UI.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { instantiateFromTemplate, PREBUILT_POLICIES } from "@/server/services/policy-library";
import { ApprovalService } from "@/server/services/approval-service";

const schema = z.object({
  templateId: z.string().min(1)
});

export const GET = authedRoute(null, async () => {
  return { templates: PREBUILT_POLICIES.map((t) => ({ id: t.id, name: t.name, description: t.description, entityType: t.entityType, action: t.action })) };
});

export const POST = authedRoute<z.infer<typeof schema>>(schema, async (ctx, body) => {
  const tpl = instantiateFromTemplate(body.templateId);
  if (!tpl) return { error: "template not found" } as any;

  // Use the existing upsert path; the dryRun=true default + validator
  // ensures the policy can't sneak in a critical field by mistake.
  const policy = await ApprovalService.upsertPolicy(ctx.orgId, tpl as any, ctx.userId);
  return { policy };
});
