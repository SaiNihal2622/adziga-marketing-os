// /api/briefs/[id]/claim — designer claims an open brief
//
// Sets assigneeId to the calling user and transitions OPEN → CLAIMED.
// Use this from the studio dashboard "Claim" button.
import { authedRoute } from "@/server/api";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const POST = authedRoute(null, async (ctx, _data, params) => {
  const brief = await ctx.prisma.brief.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  if (brief.status !== "OPEN" && brief.status !== "CLAIMED") {
    throw new AppError("INVALID_STATE", `Cannot claim brief in ${brief.status} state`, 422);
  }
  // Designers/freelancers claim for themselves; managers can reassign.
  const updated = await ctx.prisma.brief.update({
    where: { id: params.id },
    data: { assigneeId: ctx.userId, status: "CLAIMED" }
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
