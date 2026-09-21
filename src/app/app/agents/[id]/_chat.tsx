"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@prisma/client";

type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: string | null;
  status?: string;
  createdAt: string;
};

type ToolCall = {
  name: string;
  args: unknown;
  result: any;
};

export function AgentChat({ agent }: { agent: Agent }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const userText = input.trim();
    setInput("");
    setError(null);
    setSending(true);

    // Optimistically append the user message
    const optimisticUser: AgentMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      let result: any;
      if (!threadId) {
        // Create a thread + send the first message
        const r = await fetch("/api/agents/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id, firstMessage: userText })
        });
        result = await r.json();
        if (!r.ok) throw new Error(result.message ?? result.error ?? "create failed");
        setThreadId(result.threadId);
      } else {
        const r = await fetch(`/api/agents/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userText })
        });
        result = await r.json();
        if (!r.ok) throw new Error(result.message ?? result.error ?? "send failed");
      }

      // Reload the thread
      if (result.threadId || threadId) {
        const tid = result.threadId ?? threadId;
        const r = await fetch(`/api/agents/threads/${tid}`);
        const data = await r.json();
        setMessages(data.messages);
      }
    } catch (e: any) {
      setError(e?.message ?? "failed");
      // Remove the optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card-v0 flex flex-col h-[640px]">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-[10px] font-bold">
            {agent.role.slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-900">{agent.name}</div>
            <div className="text-[11px] text-ink-500">{agent.role}</div>
          </div>
        </div>
        {threadId && (
          <span className="text-[11px] text-ink-400 font-mono">thread · {threadId.slice(-6)}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-ink-500">
            Ask the {agent.name} anything. Try: "split my 50k budget for the saree client across channels".
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="text-xs text-ink-400 px-2 py-1 inline-flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-ink-400 animate-pulse" />
              <span className="inline-block size-1.5 rounded-full bg-ink-400 animate-pulse" style={{ animationDelay: "120ms" }} />
              <span className="inline-block size-1.5 rounded-full bg-ink-400 animate-pulse" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-ink-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Ask the ${agent.name} anything…`}
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-ring resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        <div className="text-[11px] text-ink-400 mt-1.5 px-1">Enter to send · Shift+Enter for newline</div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  let toolCalls: ToolCall[] = [];
  if (message.toolCalls) {
    try {
      toolCalls = JSON.parse(message.toolCalls);
    } catch {}
  }

  if (isTool) return null;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isUser ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-900 border border-ink-200"}`}>
        {message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toolCalls.map((tc, i) => (
              <div key={i} className="text-[11px] rounded border border-ink-200 bg-white px-2 py-1.5 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${tc.result?.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="text-ink-900 font-semibold">{tc.name}</span>
                </div>
                {tc.result?.summary && (
                  <div className="text-ink-600 mt-0.5 font-sans">{tc.result.summary}</div>
                )}
                {tc.result && !tc.result.ok && (
                  <div className="text-red-600 mt-0.5 font-sans">error: {tc.result.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
