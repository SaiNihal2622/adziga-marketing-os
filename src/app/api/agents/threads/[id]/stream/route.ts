// /api/agents/threads/[id]/stream — Server-Sent Events for vibe-marketing chat
//
// POST a message body, get a stream of `data: {...}` events as the agent
// runs. The runner's onEvent callback writes to an in-memory queue that
// this endpoint flushes to the response stream in SSE format.
//
// Events:
//   { type: "user_message", ... }      — inbound message persisted
//   { type: "tool_started", ... }      — tool invocation started
//   { type: "tool_completed", ... }    — tool returned
//   { type: "assistant_message", ... }  — assistant turn persisted
//   { type: "action_recorded", ... }   — agent wrote to DB
//   { type: "run_completed", ... }     — final result
//   { type: "error", ... }             — something failed
//
// Terminal event: `{ type: "run_completed" }` or `{ type: "error" }`,
// followed by an `event: done` line so the client knows to close.
import { authedRoute } from "@/server/api";
import { z } from "zod";
import type { AgentStreamEvent } from "@/server/agents/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  content: z.string().min(1).max(8000)
});

export const POST = authedRoute(schema, async (ctx, body, params) => {
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

  const encoder = new TextEncoder();
  const queue: AgentStreamEvent[] = [];
  // Use a holder object so TypeScript doesn't narrow the captured variable
  // to `never` across the closure boundary.
  const waiter: { resolve: (() => void) | null } = { resolve: null };
  let done = false;

  const emit = async (ev: AgentStreamEvent) => {
    queue.push(ev);
    if (waiter.resolve) {
      const r = waiter.resolve;
      waiter.resolve = null;
      r();
    }
  };

  // Kick off the agent in the background
  const runnerPromise = (async () => {
    try {
      await runAgentOnce({
        agentId: thread.agentId,
        threadId: thread.id,
        userMessage: body.content,
        trigger: "user_message",
        invokedBy: ctx.userId,
        onEvent: emit
      });
    } catch (e: any) {
      await emit({ type: "error", message: e?.message ?? String(e) });
    } finally {
      done = true;
      if (waiter.resolve) {
        const r = waiter.resolve;
        waiter.resolve = null;
        r();
      }
    }
  })();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      // Initial handshake so the client knows the connection is alive
      send("open", { threadId: thread.id, agentId: thread.agentId });

      while (true) {
        if (queue.length > 0) {
          const ev = queue.shift()!;
          send(ev.type, ev);
        } else if (done) {
          send("done", { ok: true });
          controller.close();
          return;
        } else {
          await new Promise<void>((resolve) => {
            waiter.resolve = resolve;
          });
        }
      }
    },
    cancel() {
      // Client disconnected — best-effort; the runner keeps going to DB
    }
  });

  // Wait for the runner to finish so Vercel doesn't kill it, but stream
  // starts immediately. We intentionally don't await runnerPromise inside
  // the response — we already wired up the stream.
  void runnerPromise;

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no" // disable nginx buffering if proxied
    }
  });
});
