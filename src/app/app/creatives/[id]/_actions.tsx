"use client";

// /app/creatives/[id]/_actions — workflow buttons (DRAFT → IN_REVIEW → …)
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreativeActions({
  creativeId,
  currentStatus,
  allowed
}: {
  creativeId: string;
  currentStatus: string;
  allowed: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(to: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/creatives/${creativeId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Transition failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (allowed.length === 0) {
    return <div className="text-xs text-ink-500 italic">No transitions available</div>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        {allowed.map((to) => (
          <button
            key={to}
            disabled={busy}
            onClick={() => transition(to)}
            className={`btn text-xs ${PRIMARY[to] ?? "btn-secondary"}`}
          >
            {LABEL[to] ?? to.replace("_", " ")}
          </button>
        ))}
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

const LABEL: Record<string, string> = {
  DRAFT: "Move back to draft",
  IN_REVIEW: "Send for review",
  APPROVED: "Approve",
  ACTIVE: "Set active",
  PAUSED: "Pause",
  ARCHIVED: "Archive"
};

const PRIMARY: Record<string, string> = {
  IN_REVIEW: "btn-primary",
  APPROVED: "btn-primary",
  ACTIVE: "btn-primary"
};
