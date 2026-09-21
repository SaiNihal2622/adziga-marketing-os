// GET /api/agents/threads/[id] — thread detail with last N messages

import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/server/api";

export const dynamic = "force-dynamic";

export const GET = authedRoute({} as any, async (ctx, _body, params) => {
  const thread = await ctx.prisma.agentThread.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: {
      agent: { select: { id: true, name: true, role: true, description: true } },
      user: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, businessName: true } }
    }
  });
  if (!thread) {
    return { error: "NOT_FOUND", message: "thread not found" };
  }
  const messages = await ctx.prisma.agentMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });
  return { thread, messages };
});
