// Adziga — Agent runner
// Executes an Agent against a thread message or a trigger. Two layers:
//
//   1. Chat mode: user posts a message → runner fetches the Agent's system
//      prompt + recent thread history → calls Gemini → if the model emits
//      tool calls, the runner validates permissions, dispatches, persists
//      AgentAction rows, then loops back for follow-up.
//
//   2. Trigger mode (cron/event): same loop but with no user message — the
//      system prompt guides the agent to either (a) act autonomously if
//      conditions warrant or (b) send a system message into a thread for
//      human review.

import { prisma } from "@/lib/db";
import { TOOL_BY_NAME, toolsForAgent, type ToolContext, type ToolResult, type ToolSpec } from "./types";
import { recommendStrategy } from "@/lib/intelligence/strategy-engine";
import { runMMMForOrg, scoreAllLeadsForOrg, optimizeBudgetForOrg, detectOrgAnomalies } from "@/lib/analytics";
import { recomputeContentPatterns } from "@/lib/intelligence/content-engine";

// ──────────────────────────────────────────────────────────────────────────
// Gemini tool-calling helper
// ──────────────────────────────────────────────────────────────────────────

type GeminiFunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

type GeminiResponse = {
  text: string | null;
  toolCalls: GeminiFunctionCall[];
  tokensIn?: number;
  tokensOut?: number;
};

async function callGeminiForAgent(opts: {
  apiKey: string;
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant" | "tool"; content: string; toolName?: string; toolCallId?: string }>;
  tools: ToolSpec[];
  model?: string;
}): Promise<GeminiResponse> {
  const cleanedKey = opts.apiKey.replace(/[^\x20-\x7E]/g, "").trim();
  const model = opts.model ?? "gemini-flash-latest";

  const contents = opts.history.map((m) => {
    if (m.role === "tool") {
      return {
        role: "function",
        parts: [{ functionResponse: { name: m.toolName!, response: { result: m.content } } }]
      };
    }
    return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
  });

  const functionDeclarations = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema as any
  }));

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cleanedKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.systemPrompt }] },
          contents,
          tools: [{ functionDeclarations }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200, topP: 0.9 }
        }),
        signal: ctrl.signal
      }
    );
    if (!r.ok) {
      const err = await r.text();
      console.error("gemini_agent_http_error", r.status, err.slice(0, 200));
      return { text: null, toolCalls: [] };
    }
    const data = (await r.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find((p: any) => p.text)?.text ?? null;
    const toolCalls: GeminiFunctionCall[] = parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));
    return {
      text,
      toolCalls,
      tokensIn: data?.usageMetadata?.promptTokenCount,
      tokensOut: data?.usageMetadata?.candidatesTokenCount
    };
  } catch (e) {
    console.error("gemini_agent_failed", e);
    return { text: null, toolCalls: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Agent prompt builder
// ──────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(agent: {
  name: string;
  role: string;
  description: string | null;
  systemPrompt: string;
  permissions: string;
}): string {
  return `${agent.systemPrompt}

IDENTITY:
- You are "${agent.name}" operating inside Adziga.
- Role: ${agent.role}
${agent.description ? `- About: ${agent.description}` : ""}

RULES:
1. You are an AI worker for a marketing agency. Your job is to take real actions inside Adziga — create campaigns, allocate budget, write content, schedule WhatsApp, etc.
2. The user (a client or Adziga team member) is talking to you through chat. Respond conversationally.
3. If you need more information before acting, ask. Otherwise, use the tools available to you.
4. You have these permissions: ${agent.permissions || "(none — read-only)"}. Tools outside this list will be refused by the server.
5. CRITICAL: when you want to mutate state, ALWAYS use a tool call. Don't claim you "did it" without invoking a tool.
6. When responding to the user, summarize what you did in plain language with the result.
7. If a tool fails, explain the failure and propose a next step.
8. Currency is INR; format big numbers with lakh/crore.`;
}

// ──────────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────────

export type AgentRunResult = {
  runId: string;
  text: string | null;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  /** Number of LLM ↔ tool roundtrips used */
  rounds: number;
};

export type AgentRunOptions = {
  agentId: string;
  threadId?: string;
  userMessage?: string;
  /** For cron/event runs: an automatic kick-off message */
  systemKickoff?: string;
  /** For runs triggered by an event (e.g. lead.created) */
  trigger?: "user_message" | "cron" | "event" | "action_followup" | "manual";
  /** Who triggered the run */
  invokedBy?: string;
  /** act-as orgId if Adziga team is operating on a client's org */
  actAsOrgId?: string;
};

/**
 * Run an Agent once. Returns the runId, the final assistant text, and the
 * tool calls that were made. Safe to call concurrently — the runner is
 * stateless except for the Prisma client.
 */
export async function runAgentOnce(opts: AgentRunOptions): Promise<AgentRunResult> {
  const apiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const agent = await prisma.agent.findUnique({
    where: { id: opts.agentId },
    include: { org: true, client: true }
  });
  if (!agent) throw new Error("agent not found");
  if (!agent.enabled) throw new Error("agent disabled");

  // Bootstrap a thread if needed
  let threadId = opts.threadId;
  if (!threadId) {
    const thread = await prisma.agentThread.create({
      data: {
        orgId: agent.orgId,
        agentId: agent.id,
        userId: opts.invokedBy,
        clientId: agent.clientId,
        title: opts.systemKickoff?.slice(0, 80) ?? opts.userMessage?.slice(0, 80) ?? "Conversation",
        metadata: opts.actAsOrgId ? JSON.stringify({ actAsOrgId: opts.actAsOrgId }) : null
      }
    });
    threadId = thread.id;
  }

  // Persist the inbound message
  if (opts.userMessage) {
    await prisma.agentMessage.create({
      data: { threadId, role: "user", content: opts.userMessage }
    });
  } else if (opts.systemKickoff) {
    await prisma.agentMessage.create({
      data: { threadId, role: "system", content: opts.systemKickoff }
    });
  }

  // Create the AgentRun row
  const run = await prisma.agentRun.create({
    data: {
      orgId: agent.orgId,
      agentId: agent.id,
      threadId,
      trigger: opts.trigger ?? "user_message",
      input: JSON.stringify({ userMessage: opts.userMessage ?? opts.systemKickoff ?? "" }),
      status: "running",
      model: "gemini-flash-latest"
    }
  });

  const start = Date.now();
  const allToolCalls: Array<{ tool: string; args: unknown; result: unknown }> = [];
  let finalText: string | null = null;
  let rounds = 0;

  try {
    // Load history (most recent 20 messages)
    const history = await prisma.agentMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 20
    });

    const tools = toolsForAgent(agent.tools);
    const toolNames = new Set(tools.map((t) => t.name));
    const allowedPerms = new Set(
      agent.permissions.split(",").map((s) => s.trim()).filter(Boolean)
    );
    const ctx: ToolContext = {
      prisma,
      orgId: opts.actAsOrgId ?? agent.orgId,
      agentId: agent.id,
      invokedBy: opts.invokedBy ?? "system",
      clientId: agent.clientId ?? undefined,
      actAsOrgId: opts.actAsOrgId,
      can: (perm: string) => allowedPerms.has(perm) || allowedPerms.has("*")
    };

    const systemPrompt = buildSystemPrompt(agent);

    // Build conversation history for Gemini
    const convo: Array<{ role: "user" | "assistant" | "tool"; content: string; toolName?: string; toolCallId?: string }> = [];
    for (const m of history) {
      if (m.role === "user") {
        convo.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        if (m.toolCalls) {
          // Replay: text-only or empty content + tool calls
          convo.push({ role: "assistant", content: m.content || " " });
          try {
            const calls = JSON.parse(m.toolCalls);
            for (const c of calls) {
              convo.push({
                role: "tool",
                content: typeof c.result === "string" ? c.result : JSON.stringify(c.result),
                toolName: c.name
              });
            }
          } catch {}
        } else {
          convo.push({ role: "assistant", content: m.content });
        }
      }
    }

    // Loop: call Gemini → dispatch tools → call Gemini again (up to 4 rounds)
    const maxRounds = 4;
    while (rounds < maxRounds) {
      rounds++;
      const llm = await callGeminiForAgent({ apiKey, systemPrompt, history: convo, tools });

      if (!llm.text && llm.toolCalls.length === 0) {
        // No content, abort
        finalText = "I couldn't generate a response. Let me know what you'd like me to do.";
        break;
      }

      // Persist assistant message + any tool calls
      const persistedToolCalls: Array<{ name: string; args: unknown; result: unknown }> = [];
      const intentForActions: Array<{ name: string; args: any; result: any }> = [];

      for (const tc of llm.toolCalls) {
        if (!toolNames.has(tc.name)) {
          // Tool not in agent's allowlist — refuse
          intentForActions.push({ name: tc.name, args: tc.args, result: { ok: false, error: `tool "${tc.name}" not in agent allowlist` } });
          continue;
        }
        const tool = TOOL_BY_NAME[tc.name];
        try {
          const result = await tool.handler(tc.args, ctx);
          intentForActions.push({ name: tc.name, args: tc.args, result });
          allToolCalls.push({ tool: tc.name, args: tc.args, result });
          if (result.recordAction) {
            await prisma.agentAction.create({
              data: {
                orgId: agent.orgId,
                agentId: agent.id,
                threadId,
                clientId: agent.clientId,
                type: result.recordAction.type,
                summary: result.recordAction.summary,
                payload: JSON.stringify(result.recordAction.payload ?? {}),
                status: result.ok ? "completed" : "failed",
                autoApproved: true,
                runId: run.id,
                approvedAt: result.ok ? new Date() : null
              }
            });
            await prisma.auditLog.create({
              data: {
                orgId: agent.orgId,
                userId: opts.invokedBy,
                action: `agent.${result.recordAction.type}`,
                entityType: "AgentAction",
                entityId: tc.name,
                after: JSON.stringify(result.recordAction.payload ?? {})
              }
            });
          }
        } catch (e: any) {
          intentForActions.push({ name: tc.name, args: tc.args, result: { ok: false, error: e?.message ?? "tool error" } });
        }
      }

      // Persist the assistant turn
      await prisma.agentMessage.create({
        data: {
          threadId,
          role: "assistant",
          content: llm.text ?? "",
          toolCalls: JSON.stringify(intentForActions),
          tokensIn: llm.tokensIn,
          tokensOut: llm.tokensOut,
          model: "gemini-flash-latest",
          status: "complete"
        }
      });

      // If no tool calls, this is the final answer
      if (llm.toolCalls.length === 0) {
        finalText = llm.text;
        break;
      }

      // Build next round: append assistant turn + tool results
      convo.push({ role: "assistant", content: llm.text ?? " " });
      for (const tc of intentForActions) {
        convo.push({
          role: "tool",
          content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
          toolName: tc.name
        });
      }
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        output: JSON.stringify({ text: finalText, toolCalls: allToolCalls }),
        toolCallCount: allToolCalls.length,
        completedAt: new Date(),
        durationMs: Date.now() - start
      }
    });
    await prisma.agent.update({
      where: { id: agent.id },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() }
    });

    // Touch thread lastMessageAt
    await prisma.agentThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() }
    });

    return { runId: run.id, text: finalText, toolCalls: allToolCalls, rounds };
  } catch (e: any) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: e?.message ?? String(e),
        completedAt: new Date(),
        durationMs: Date.now() - start
      }
    }).catch(() => null);
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastError: e?.message ?? String(e) }
    }).catch(() => null);
    throw e;
  }
}
