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
// Terminal event: an `event: done` line so the client knows to close.
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { z } from "zod";
import type { AgentStreamEvent } from "@/server/agents/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  content: z.string().min(1).max(8000)
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  // Auth — bypass authedRoute because it JSON-serializes the response.
  // We need a raw ReadableStream for SSE.
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Parse + validate
  const raw = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "VALIDATION", details: parsed.error.issues }), {
      status: 422,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = parsed.data;

  const thread = await prisma.agentThread.findFirst({
    where: { id: ctx.params.id, orgId: session.orgId },
    include: { agent: true }
  });
  if (!thread) {
    return new Response(JSON.stringify({ error: "NOT_FOUND", message: "thread not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!thread.agent.enabled) {
    return new Response(JSON.stringify({ error: "AGENT_DISABLED" }), {
      status: 422,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { runAgentOnce } = await import("@/server/agents/runner");

  const encoder = new TextEncoder();
  const queue: AgentStreamEvent[] = [];
  // Holder pattern — TypeScript narrows captured variables to `never`
  // across the closure boundary, so we use a mutable object.
  const waiter: { resolve: (() => void) | null } = { resolve: null };
  let done = false;

  const emit = (ev: AgentStreamEvent) => {
    queue.push(ev);
    if (waiter.resolve) {
      const r = waiter.resolve;
      waiter.resolve = null;
      r();
    }
  };

  // Kick off the agent in the background. We intentionally don't await
  // inside the response — the SSE stream is what we hand back.
  const runnerPromise = (async () => {
    try {
      await runAgentOnce({
        agentId: thread.agentId,
        threadId: thread.id,
        userMessage: body.content,
        trigger: "user_message",
        invokedBy: session.userId,
        onEvent: emit
      });
    } catch (e: any) {
      emit({ type: "error", message: e?.message ?? String(e) });
    } finally {
      done = true;
      if (waiter.resolve) {
        const r = waiter.resolve;
        waiter.resolve = null;
        r();
      }
    }
  })();

  // Build the SSE response
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* controller closed — fine */
        }
      };

      // Initial handshake so the client knows the connection is alive
      send("open", { threadId: thread.id, agentId: thread.agentId });

      while (true) {
        if (queue.length > 0) {
          const ev = queue.shift()!;
          send(ev.type, ev);
        } else if (done) {
          send("done", { ok: true });
          try {
            controller.close();
          } catch { /* already closed */ }
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
      // so the user sees the result on page reload.
    }
  });

  // Best-effort: ensure runner is awaited so Vercel doesn't kill it.
  void runnerPromise;

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
