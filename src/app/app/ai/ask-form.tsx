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
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, clientId: clientId || undefined })
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setResponse(data.response);
      router.refresh();
    } else {
      setResponse("Sorry — something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input md:col-span-1">
          <option value="">— All clients —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input md:col-span-2"
          placeholder="Ask about a campaign, KPI, or report…"
          required
        />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>
      {response && (
        <div className="mt-3 p-4 rounded-lg bg-brand-50 border border-brand-200 text-sm">
          <div className="text-xs font-semibold text-brand-700 mb-1">Adziga Assistant</div>
          <div className="text-ink-900 whitespace-pre-wrap">{response}</div>
        </div>
      )}
    </form>
  );
}