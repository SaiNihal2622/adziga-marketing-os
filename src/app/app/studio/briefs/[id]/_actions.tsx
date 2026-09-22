"use client";

// /app/studio/briefs/[id]/_actions — claim, deliver, transition
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BriefActions({
  briefId,
  currentStatus,
  allowedTransitions,
  isClaimable,
  canDeliver,
  canTransition,
  isMyBrief,
  deliveredAssetUrl
}: {
  briefId: string;
  currentStatus: string;
  allowedTransitions: string[];
  isClaimable: boolean;
  canDeliver: boolean;
  canTransition: boolean;
  isMyBrief: boolean;
  deliveredAssetUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverUrl, setDeliverUrl] = useState(deliveredAssetUrl ?? "");
  const [deliverNote, setDeliverNote] = useState("");

  async function call(path: string, method: "POST" = "POST", body?: any) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Request failed");
      router.refresh();
      if (path.endsWith("/deliver")) setDeliverOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        {isClaimable && (
          <button disabled={busy} onClick={() => call(`/api/briefs/${briefId}/claim`)} className="btn btn-primary text-xs">
            Claim this brief
          </button>
        )}
        {canDeliver && currentStatus !== "DELIVERED" && (
          <button disabled={busy} onClick={() => setDeliverOpen((o) => !o)} className="btn btn-secondary text-xs">
            {deliveredAssetUrl ? "Update delivery" : "Deliver"}
          </button>
        )}
        {canTransition && allowedTransitions.map((to) => (
          <button
            key={to}
            disabled={busy}
            onClick={() => call(`/api/briefs/${briefId}/transition`, "POST", { to })}
            className={`btn text-xs ${PRIMARY[to] ?? "btn-secondary"}`}
          >
            {LABEL[to] ?? to.replace("_", " ")}
          </button>
        ))}
      </div>

      {deliverOpen && (
        <div className="card-v0 p-3 w-full max-w-md space-y-2 bg-blue-50/40">
          <input
            type="url"
            value={deliverUrl}
            onChange={(e) => setDeliverUrl(e.target.value)}
            placeholder="https://... (upload to /uploads via /app/creatives/new and paste the URL here)"
            className="input"
          />
          <textarea
            value={deliverNote}
            onChange={(e) => setDeliverNote(e.target.value)}
            rows={2}
            placeholder="Note for the reviewer (optional)"
            className="input"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeliverOpen(false)} className="btn btn-secondary text-xs">Cancel</button>
            <button
              disabled={busy || !deliverUrl}
              onClick={() => call(`/api/briefs/${briefId}/deliver`, "POST", { assetUrl: deliverUrl, note: deliverNote || undefined })}
              className="btn btn-primary text-xs"
            >
              Submit for review
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

const LABEL: Record<string, string> = {
  OPEN: "Unclaim",
  CLAIMED: "Start work",
  IN_PROGRESS: "Send for review",
  IN_REVIEW: "Mark delivered",
  ARCHIVED: "Archive"
};

const PRIMARY: Record<string, string> = {
  "IN_PROGRESS": "btn-primary",
  "IN_REVIEW": "btn-primary",
  "DELIVERED": "btn-primary"
};
