// /api/briefs/[id] — detail + edit + delete
import { authedRoute } from "@/server/api";
import { updateBriefSchema } from "@/server/schemas";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = authedRoute(null, async (ctx, _data, params) => {
  const brief = await ctx.prisma.brief.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: {
      client: true,
      campaign: true,
      assignee: { select: { id: true, name: true, email: true, image: true } },
      creator: { select: { id: true, name: true, email: true, image: true } }
    }
  });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  return { brief: serialize(brief) };
});

export const PATCH = authedRoute(updateBriefSchema, async (ctx, body, params) => {
  const brief = await ctx.prisma.brief.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  const updated = await ctx.prisma.brief.update({
    where: { id: params.id },
    data: {
      title: body.title,
      brief: body.brief,
      format: body.format,
      platform: body.platform,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : brief.dueDate,
      referenceUrls: body.referenceUrls,
      copyDirection: body.copyDirection,
      assigneeId: body.assigneeId,
      clientId: body.clientId,
      campaignId: body.campaignId
    }
  });
  return { brief: serialize(updated) };
});

export const DELETE = authedRoute(null, async (ctx, _data, params) => {
  const brief = await ctx.prisma.brief.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!brief) throw new AppError("NOT_FOUND", "Brief not found", 404);
  await ctx.prisma.brief.delete({ where: { id: params.id } });
  return { ok: true };
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
