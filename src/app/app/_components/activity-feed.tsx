"use client";

// Adziga — ActivityFeed (Sprint 8b)
// Live event feed via Server-Sent Events. Subscribes to /api/activity/stream
// and prepends new events as they arrive. Reconnects automatically after
// disconnects. Falls back gracefully if SSE is blocked (some browsers /
// proxies strip text/event-stream) by polling /api/activity/recent instead.

import { useEffect, useRef, useState } from "react";

type Event = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  userName: string;
  ts: string;
};

const POLL_FALLBACK_MS = 5_000;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function severity(action: string): "danger" | "warning" | "info" {
  if (action.startsWith("policy.delete") || action.includes("error") || action.includes("fail")) return "danger";
  if (action.includes("auto_apply") || action.includes("start") || action.includes("complete")) return "warning";
  return "info";
}

function severityDot(s: "danger" | "warning" | "info"): string {
  if (s === "danger") return "bg-rose-500";
  if (s === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

export function ActivityFeed({ initialEvents, limit = 25 }: { initialEvents: Event[]; limit?: number }) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [connected, setConnected] = useState(false);
  const lastSeenRef = useRef<string | null>(initialEvents[0]?.id ?? null);
  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function attachSSE() {
      if (cancelled) return;
      try {
        const url = new URL("/api/activity/stream", window.location.origin);
        if (lastSeenRef.current) url.searchParams.set("lastSeenId", lastSeenRef.current);
        const es = new EventSource(url.toString());
        esRef.current = es;
        es.onopen = () => {
          setConnected(true);
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        };
        es.onmessage = (msg) => {
          if (!msg.data || msg.data.startsWith(":")) return;
          try {
            const ev = JSON.parse(msg.data) as Event;
            setEvents((prev) => {
              if (prev.some((p) => p.id === ev.id)) return prev;
              const next = [ev, ...prev].slice(0, limit);
              lastSeenRef.current = next[0]?.id ?? lastSeenRef.current;
              return next;
            });
          } catch {
            /* malformed payload — skip */
          }
        };
        es.onerror = () => {
          setConnected(false);
          es.close();
          esRef.current = null;
          // Fall back to polling.
          if (!pollTimerRef.current) startPolling();
          // Try SSE again in 30s.
          setTimeout(() => {
            if (!cancelled) attachSSE();
          }, 30_000);
        };
      } catch {
        // SSE blocked — poll only.
        if (!pollTimerRef.current) startPolling();
      }
    }

    function startPolling() {
      if (pollTimerRef.current) return;
      const tick = async () => {
        try {
          const r = await fetch(`/api/activity/recent?limit=${limit}`, { credentials: "include" });
          if (r.ok) {
            const j = await r.json();
            const newEvents = (j.events ?? []) as Event[];
            // Server returns newest first; reverse so we can dedupe by id.
            setEvents((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const merged = [...newEvents.filter((e) => !seen.has(e.id)).reverse(), ...prev];
              const next = merged.slice(0, limit);
              lastSeenRef.current = next[0]?.id ?? lastSeenRef.current;
              return next;
            });
          }
        } catch {
          /* swallow */
        }
      };
      tick();
      pollTimerRef.current = window.setInterval(tick, POLL_FALLBACK_MS);
    }

    attachSSE();

    return () => {
      cancelled = true;
      if (esRef.current) esRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [limit]);

  return (
    <div className="card-v0 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold tracking-tight">Live activity</h3>
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
              connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
            title={connected ? "SSE stream connected" : "Polling for updates (SSE unavailable)"}
          >
            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {connected ? "live" : "polling"}
          </span>
        </div>
        <Link href="/app/audit" className="text-xs text-brand-600 hover:underline">All →</Link>
      </div>
      <ul className="space-y-2 max-h-[480px] overflow-y-auto">
        {events.length === 0 && <li className="text-sm text-ink-500 py-2">No activity yet.</li>}
        {events.map((e) => {
          const s = severity(e.action);
          return (
            <li key={e.id} className="flex gap-2.5 items-start text-sm">
              <div className={`mt-1.5 size-1.5 rounded-full ${severityDot(s)} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{e.summary}</div>
                <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span>{e.userName}</span>
                  <span>·</span>
                  <span>{timeAgo(e.ts)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// We need a Link for the "All →" — re-export the default so consumers don't need to import.
import Link from "next/link";
