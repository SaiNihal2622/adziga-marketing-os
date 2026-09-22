// /api/briefs — list + create designer briefs
import { authedRoute } from "@/server/api";
import { listBriefsSchema, createBriefSchema } from "@/server/schemas";

export const dynamic = "force-dynamic";

export const GET = authedRoute(listBriefsSchema, async (ctx, body) => {
  const where: any = { orgId: ctx.orgId };
  if (body.status) where.status = body.status;
  if (body.priority) where.priority = body.priority;
  if (body.assigneeId) where.assigneeId = body.assigneeId;
  if (body.clientId) where.clientId = body.clientId;
  if (body.campaignId) where.campaignId = body.campaignId;
  if (body.q) {
    where.OR = [
      { title: { contains: body.q, mode: "insensitive" } },
      { brief: { contains: body.q, mode: "insensitive" } }
    ];
  }
  const items = await ctx.prisma.brief.findMany({
    where,
    take: body.take,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, businessName: true } },
      campaign: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } }
    }
  });
  return { items: items.map(serialize) };
});

export const POST = authedRoute(createBriefSchema, async (ctx, body) => {
  // Only operators (FOUNDER/ADMIN/MARKETING_MANAGER/CAMPAIGN_MANAGER/CONTENT)
  // can create briefs. Clients cannot create designer briefs for their own
  // work (they're the recipients, not the creators).
  if (["CLIENT_ADMIN", "CLIENT_MEMBER"].includes(ctx.role)) {
    throw Object.assign(new Error("Clients can't create designer briefs"), { status: 403 });
  }
  const brief = await ctx.prisma.brief.create({
    data: {
      orgId: ctx.orgId,
      clientId: body.clientId,
      campaignId: body.campaignId,
      title: body.title,
      brief: body.brief,
      format: body.format,
      platform: body.platform,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      referenceUrls: body.referenceUrls,
      copyDirection: body.copyDirection,
      assigneeId: body.assigneeId,
      createdById: ctx.userId,
      status: body.assigneeId ? "CLAIMED" : "OPEN"
    }
  });
  return { brief: serialize(brief) };
});

function serialize(b: any) {
  if (!b) return b;
  return {
    ...b,
    // BigInt safety: dates serialize fine but timestamps might also have ms — keep as ISO
    dueDate: b.dueDate ? b.dueDate.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString()
  };
}
