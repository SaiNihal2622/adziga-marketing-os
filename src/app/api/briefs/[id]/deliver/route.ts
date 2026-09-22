// /api/briefs/[id]/deliver — designer uploads final asset and marks delivered
//
// Body: { assetUrl: string, note?: string }
// Transitions: CLAIMED/IN_PROGRESS → IN_REVIEW
// The reviewer (operator role) later moves it to DELIVERED via /transition.
import { authedRoute } from "@/server/api";
import { deliverBriefSchema } from "@/server/schemas";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const POST = authedRoute(deliverBriefSchema, async (ctx, body, params) => {
  const brief = await ctx.prisma.brief.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  if (!["CLAIMED", "IN_PROGRESS", "IN_REVIEW"].includes(brief.status)) {
    throw new AppError("INVALID_STATE", `Cannot deliver brief in ${brief.status} state`, 422);
  }
  // Only the assigned designer (or an operator) can deliver
  if (brief.assigneeId !== ctx.userId && !["FOUNDER", "ADMIN", "SUPER_ADMIN"].includes(ctx.role)) {
    throw new AppError("FORBIDDEN", "Only the assigned designer can deliver this brief", 403);
  }
  const updated = await ctx.prisma.brief.update({
    where: { id: params.id },
    data: {
      deliveredAssetUrl: body.assetUrl,
      deliveredNote: body.note,
      status: "IN_REVIEW"
    }
  });
  return { brief: serialize(updated) };
});

function serialize(b: any) {
  return {
    ...b,
    dueDate: b.dueDate ? b.dueDate.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString()
  };
}
