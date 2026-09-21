// Adziga — Agent Threads API
//   GET  /api/agents/threads             — list threads in the org
//   POST /api/agents/threads             — create a new thread (optionally with first message)
//   GET  /api/agents/threads/:id         — get thread + last N messages
//   POST /api/agents/threads/:id/messages — post a message and trigger the agent run

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";

export const dynamic = "force-dynamic";

export const GET = authedRoute(z.object({}).optional() ?? z.object({}).optional(), async (ctx) => {
  const threads = await ctx.prisma.agentThread.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: {
      agent: { select: { id: true, name: true, role: true } },
      user: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, businessName: true } },
      _count: { select: { messages: true } }
    }
  });
  return { threads };
});

const createSchema = z.object({
  agentId: z.string(),
  clientId: z.string().optional(),
  title: z.string().optional(),
  firstMessage: z.string().optional()
});

export const POST = authedRoute(createSchema, async (ctx, body) => {
  // Confirm agent belongs to this org
  const agent = await ctx.prisma.agent.findFirst({
    where: { id: body.agentId, orgId: ctx.orgId }
  });
  if (!agent) {
    return { error: "NOT_FOUND", message: "agent not found" };
  }

  const thread = await ctx.prisma.agentThread.create({
    data: {
      orgId: ctx.orgId,
      agentId: agent.id,
      clientId: body.clientId,
      userId: ctx.userId,
      title: body.title || (body.firstMessage?.slice(0, 80) ?? "New conversation")
    }
  });

  if (body.firstMessage) {
    // Trigger the agent run synchronously for snappy UX on the first turn.
    const { runAgentOnce } = await import("@/server/agents/runner");
    try {
      const result = await runAgentOnce({
        agentId: agent.id,
        threadId: thread.id,
        userMessage: body.firstMessage,
        trigger: "user_message",
        invokedBy: ctx.userId
      });
      return { threadId: thread.id, run: result };
    } catch (e: any) {
      return { threadId: thread.id, error: e?.message ?? "agent run failed" };
    }
  }

  return { threadId: thread.id };
});
