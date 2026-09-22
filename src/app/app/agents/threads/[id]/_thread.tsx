"use client";

import { useEffect, useRef, useState } from "react";

type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: string | null;
  status?: string;
  createdAt: string;
};

type ToolCall = { name: string; args: unknown; result: any };

export function ThreadView({
  threadId,
  agentName,
  agentRole,
  initialMessages
}: {
  threadId: string;
  agentName: string;
  agentRole: string;
  initialMessages: AgentMessage[];
}) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    const optimistic: AgentMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);

    // Placeholder for the live assistant turn that grows as events stream in.
    const placeholderId = `live-${Date.now()}`;
    let liveText = "";
    const liveActions: Array<{ type: string; summary: string }> = [];

    try {
      // Try streaming endpoint first (gives live updates as the agent works).
      const r = await fetch(`/api/agents/threads/${threadId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content: text })
      });

      if (!r.ok || !r.body) {
        // Fall back to the non-streaming endpoint if SSE isn't supported.
        const r2 = await fetch(`/api/agents/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text })
        });
        const data = await r2.json();
        if (!r2.ok) throw new Error(data.message ?? data.error ?? "send failed");
        const tr = await fetch(`/api/agents/threads/${threadId}`);
        const td = await tr.json();
        setMessages(td.messages);
        return;
      }

      // Stream the SSE response
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let liveAssistantId: string | null = null;

      // Seed the live assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: placeholderId,
          role: "assistant",
          content: "",
          toolCalls: null,
          status: "streaming",
          createdAt: new Date().toISOString()
        }
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Parse SSE events: lines of "event: type\ndata: json\n\n"
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = evt.split("\n");
          let evType = "message";
          let evData = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) evType = line.slice(7).trim();
            else if (line.startsWith("data: ")) evData += line.slice(6);
          }
          if (!evData || evType === "done") continue;
          let payload: any;
          try {
            payload = JSON.parse(evData);
          } catch {
            continue;
          }

          if (evType === "assistant_message") {
            liveAssistantId = payload.messageId;
            liveText = payload.content ?? "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? { ...m, id: payload.messageId ?? placeholderId, content: liveText, status: "streaming" }
                  : m
              )
            );
          } else if (evType === "tool_started") {
            liveText += `\n\n> ⚙️ Running ${payload.tool}…\n`;
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, content: liveText } : m))
            );
          } else if (evType === "tool_completed") {
            liveText += `> ✓ ${payload.tool} done.\n`;
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, content: liveText } : m))
            );
          } else if (evType === "action_recorded") {
            liveActions.push({ type: payload.actionType, summary: payload.summary });
            liveText += `\n• ${payload.summary}\n`;
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, content: liveText } : m))
            );
          } else if (evType === "run_completed") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      id: liveAssistantId ?? placeholderId,
                      content: payload.text ?? liveText,
                      toolCalls: JSON.stringify(liveActions.map((a) => ({ name: a.type, args: a }))),
                      status: "complete"
                    }
                  : m
              )
            );
          } else if (evType === "error") {
            setError(payload.message);
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, status: "error" } : m))
            );
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "failed");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card-v0 flex flex-col h-[640px]">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2">
        <div className="size-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-[10px] font-bold">
          {agentRole.slice(0, 2)}
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-900">{agentName}</div>
          <div className="text-[11px] text-ink-500">{agentRole}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
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
                send();
              }
            }}
            placeholder={`Reply to ${agentName}…`}
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-ring"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AgentMessage }) {
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
        {message.content && <div className="whitespace-pre-wrap break-words">{message.content}</div>}
        {toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toolCalls.map((tc, i) => (
              <div key={i} className="text-[11px] rounded border border-ink-200 bg-white px-2 py-1.5 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${tc.result?.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="text-ink-900 font-semibold">{tc.name}</span>
                </div>
                {tc.result?.summary && <div className="text-ink-600 mt-0.5 font-sans">{tc.result.summary}</div>}
                {tc.result && !tc.result.ok && <div className="text-red-600 mt-0.5 font-sans">error: {tc.result.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
