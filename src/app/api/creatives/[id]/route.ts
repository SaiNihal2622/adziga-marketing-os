// /api/creatives/[id] — get, patch, delete
import { authedRoute } from "@/server/api";
import { updateCreativeSchema } from "@/server/schemas";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = authedRoute(null, async (ctx, _data, params) => {
  const creative = await ctx.prisma.creative.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: {
      campaign: { select: { id: true, name: true, client: { select: { id: true, businessName: true } } } }
    }
  });
  if (!creative) throw new AppError("NOT_FOUND", "Creative not found", 404);
  return { creative };
});

export const PATCH = authedRoute(updateCreativeSchema, async (ctx, body, params) => {
  const creative = await ctx.prisma.creative.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!creative) throw new AppError("NOT_FOUND", "Creative not found", 404);
  const updated = await ctx.prisma.creative.update({
    where: { id: params.id },
    data: {
      name: body.name,
      format: body.format,
      platform: body.platform,
      hook: body.hook,
      headline: body.headline,
      primaryCopy: body.primaryCopy,
      cta: body.cta,
      audience: body.audience,
      source: body.source,
      creator: body.creator,
      mediaUrl: body.mediaUrl,
      thumbnailUrl: body.thumbnailUrl,
      campaignId: body.campaignId,
      version: { increment: 1 }
    }
  });
  return { creative: updated };
});

export const DELETE = authedRoute(null, async (ctx, _data, params) => {
  const creative = await ctx.prisma.creative.findFirst({ where: { id: params.id, orgId: ctx.orgId } });
  if (!creative) throw new AppError("NOT_FOUND", "Creative not found", 404);
  await ctx.prisma.creative.delete({ where: { id: params.id } });
  return { ok: true };
});
