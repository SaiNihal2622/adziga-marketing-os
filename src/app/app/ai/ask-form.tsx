"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AskAssistant({
  clients,
  defaultClientId
}: {
  clients: Array<{ id: string; name: string }>;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, clientId: clientId || undefined })
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data.response);
        setModel(data.model ?? null);
        setLatencyMs(data.latencyMs ?? null);
        router.refresh();
      } else {
        // Try to surface the real error so the user (and we) can debug it.
        const body = await res.text();
        let detail = body;
        try {
          const parsed = JSON.parse(body);
          detail = parsed.error || parsed.message || body;
        } catch {}
        setError(`Request failed (${res.status}): ${detail.slice(0, 240)}`);
        setResponse("Sorry — I hit an error answering that. The server said:\n\n" + (detail || "(no body)").slice(0, 600));
      }
    } catch (e: any) {
      setError(`Network error: ${e?.message ?? "unknown"}`);
      setResponse("Sorry — couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input md:col-span-1">
          <option value="">- All clients -</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input md:col-span-2"
          placeholder="Ask about a campaign, KPI, or report..."
          required
        />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>
      {response && (
        <div className={`mt-3 p-4 rounded-lg border text-sm ${error ? "bg-red-50 border-red-200" : "bg-brand-50 border-brand-200"}`}>
          <div className={`text-xs font-semibold mb-1 ${error ? "text-red-700" : "text-brand-700"}`}>
            {error ? "Error" : "Adziga Assistant"}
            {!error && model && (
              <span className="ml-2 text-ink-500 font-normal">
                · {model}{latencyMs != null ? ` · ${latencyMs}ms` : ""}
              </span>
            )}
          </div>
          <div className="text-ink-900 whitespace-pre-wrap">{response}</div>
        </div>
      )}
    </form>
  );
}