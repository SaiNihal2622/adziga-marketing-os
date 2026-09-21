// /api/creatives — list + create
import { authedRoute } from "@/server/api";
import { listCreativesSchema, createCreativeV2Schema } from "@/server/schemas";

export const dynamic = "force-dynamic";

export const GET = authedRoute(listCreativesSchema, async (ctx, body) => {
  const where: any = { orgId: ctx.orgId };
  if (body.campaignId) where.campaignId = body.campaignId;
  if (body.clientId) where.campaign = { clientId: body.clientId };
  if (body.status) where.status = body.status;
  if (body.format) where.format = body.format;
  if (body.platform) where.platform = body.platform;
  if (body.source) where.source = body.source;
  if (body.q) {
    where.OR = [
      { name: { contains: body.q, mode: "insensitive" } },
      { headline: { contains: body.q, mode: "insensitive" } },
      { primaryCopy: { contains: body.q, mode: "insensitive" } },
      { hook: { contains: body.q, mode: "insensitive" } }
    ];
  }
  const items = await ctx.prisma.creative.findMany({
    where,
    take: body.take,
    orderBy: { updatedAt: "desc" },
    include: {
      campaign: { select: { id: true, name: true, client: { select: { id: true, businessName: true } } } }
    }
  });
  return { items };
});

export const POST = authedRoute(createCreativeV2Schema, async (ctx, body) => {
  const creative = await ctx.prisma.creative.create({
    data: {
      orgId: ctx.orgId,
      campaignId: body.campaignId,
      // clientId isn't on Creative directly — it's on Campaign. If provided
      // without a campaignId, we'll need to either resolve a campaign or
      // store it as metadata. For now, require campaignId or drop clientId.
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
      status: "DRAFT"
    }
  });
  return { creative };
});
