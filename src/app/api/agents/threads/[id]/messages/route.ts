// POST /api/agents/threads/[id]/messages — append user message, run agent synchronously

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  content: z.string().min(1).max(8000)
});

export const POST = authedRoute(schema, async (ctx, body, params) => {
  // Confirm thread belongs to this org
  const thread = await ctx.prisma.agentThread.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: { agent: true }
  });
  if (!thread) {
    return { error: "NOT_FOUND", message: "thread not found" };
  }
  if (!thread.agent.enabled) {
    return { error: "AGENT_DISABLED", message: "this agent is currently disabled" };
  }

  const { runAgentOnce } = await import("@/server/agents/runner");
  try {
    const result = await runAgentOnce({
      agentId: thread.agentId,
      threadId: thread.id,
      userMessage: body.content,
      trigger: "user_message",
      invokedBy: ctx.userId
    });
    return { run: result };
  } catch (e: any) {
    return { error: "AGENT_FAILED", message: e?.message ?? "agent run failed" };
  }
});
