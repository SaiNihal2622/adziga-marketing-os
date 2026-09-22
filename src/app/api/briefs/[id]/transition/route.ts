// /api/briefs/[id]/transition — workflow
//
// OPEN       → CLAIMED (by assignee) | ARCHIVED
// CLAIMED    → IN_PROGRESS | OPEN (unclaim) | ARCHIVED
// IN_PROGRESS→ IN_REVIEW | OPEN
// IN_REVIEW  → DELIVERED (reviewer accepts) | IN_PROGRESS (rework)
// DELIVERED  → ARCHIVED
import { authedRoute } from "@/server/api";
import { transitionBriefSchema } from "@/server/schemas";
import { AppError } from "@/server/errors";

const ALLOWED: Record<string, string[]> = {
  OPEN: ["CLAIMED", "ARCHIVED"],
  CLAIMED: ["IN_PROGRESS", "OPEN", "ARCHIVED"],
  IN_PROGRESS: ["IN_REVIEW", "OPEN"],
  IN_REVIEW: ["DELIVERED", "IN_PROGRESS"],
  DELIVERED: ["ARCHIVED"],
  ARCHIVED: []
};

export const dynamic = "force-dynamic";

export const POST = authedRoute(transitionBriefSchema, async (ctx, body, params) => {
  const brief = await ctx.prisma.brief.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  const from = brief.status;
  const to = body.to;
  if (!ALLOWED[from]?.includes(to)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move brief from ${from} to ${to}`, 422, { from, to, allowed: ALLOWED[from] });
  }
  const updated = await ctx.prisma.brief.update({
    where: { id: params.id },
    data: { status: to, ...(to === "OPEN" ? { assigneeId: null } : {}) }
  });
  return { brief: serialize(updated), from, to };
});

function serialize(b: any) {
  if (!b) return b;
  return {
    ...b,
    dueDate: b.dueDate ? b.dueDate.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString()
  };
}
