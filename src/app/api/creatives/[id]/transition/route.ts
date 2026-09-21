// /api/creatives/[id]/transition — status workflow
//
// Allowed transitions:
//   DRAFT       -> IN_REVIEW | ARCHIVED
//   IN_REVIEW   -> APPROVED | DRAFT (rejected back)
//   APPROVED    -> ACTIVE | DRAFT (needs revision)
//   ACTIVE      -> PAUSED | ARCHIVED
//   PAUSED      -> ACTIVE | ARCHIVED
//   ARCHIVED    -> DRAFT (restore)
import { authedRoute } from "@/server/api";
import { creativeTransitionSchema } from "@/server/schemas";
import { AppError } from "@/server/errors";

const ALLOWED: Record<string, string[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE", "DRAFT"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT"]
};

export const dynamic = "force-dynamic";

export const POST = authedRoute(creativeTransitionSchema, async (ctx, body, params) => {
  const creative = await ctx.prisma.creative.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!creative) throw new AppError("NOT_FOUND", "Creative not found", 404);
  const from = creative.status;
  const to = body.to;
  if (!ALLOWED[from]?.includes(to)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move creative from ${from} to ${to}`, 422, { from, to, allowed: ALLOWED[from] });
  }
  const updated = await ctx.prisma.creative.update({
    where: { id: params.id },
    data: { status: to }
  });
  return {
    creative: {
      ...updated,
      impressions: Number(updated.impressions ?? 0),
      reach: Number(updated.reach ?? 0),
      leads: Number(updated.leads ?? 0),
      conversions: Number(updated.conversions ?? 0)
    },
    from,
    to
  };
});
