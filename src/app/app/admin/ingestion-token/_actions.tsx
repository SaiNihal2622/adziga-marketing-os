"use client";

// Adziga — IngestionTokenActions (Sprint 19c)
// Client component that mints / revokes the org's ingestion token and
// shows the freshly-minted token to the user (one-time display — warn
// the user to copy it before refresh).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_components/ui";

export function IngestionTokenActions({ hasToken }: { hasToken: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"mint" | "revoke" | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const mint = async () => {
    setBusy("mint");
    setError(null);
    setFresh(null);
    setRevoked(false);
    try {
      const res = await fetch("/api/admin/ingestion-token", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setFresh(j.token);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!confirm("Revoke the current token? Any clients using it will get 401s.")) return;
    setBusy("revoke");
    setError(null);
    try {
      const res = await fetch("/api/admin/ingestion-token/revoke", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      setRevoked(true);
      setFresh(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
    } catch {
      // ignore — manual copy still works via the textarea
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={mint} disabled={busy !== null}>
          {busy === "mint" ? "Minting…" : hasToken ? "↻ Rotate (replace existing)" : "Mint new token"}
        </Button>
        {hasToken && (
          <Button variant="outline" onClick={revoke} disabled={busy !== null} className="border-rose-300 text-rose-700 hover:bg-rose-50">
            {busy === "revoke" ? "Revoking…" : "Revoke existing"}
          </Button>
        )}
        {error && <span className="text-xs text-rose-700">✕ {error}</span>}
        {revoked && <span className="text-xs text-amber-700">✓ Token revoked · mint a new one if needed</span>}
      </div>

      {fresh && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">Fresh token</div>
              <p className="text-xs text-ink-700 mt-1">
                Copy this token now — it won't be shown in plain again. Store it in your Meta/Google sync job's
                secret.
              </p>
            </div>
            <button
              onClick={copy}
              className="text-xs font-mono px-2 py-1 rounded bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              Copy
            </button>
          </div>
          <textarea
            readOnly
            value={fresh}
            onClick={(e) => e.currentTarget.select()}
            rows={2}
            className="block w-full rounded border border-emerald-200 px-3 py-2 text-xs font-mono bg-white"
          />
        </div>
      )}

      <div className="text-xs text-ink-500">
        <p className="font-semibold text-ink-700 mb-1">Rotate workflow:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Click "Rotate" → a fresh token is shown above.</li>
          <li>Update the secret in your Meta/Google/sheet sync job.</li>
          <li>Verify the next ingestion succeeds (look in <a href="/app/admin/webhooks" className="text-brand-600 hover:underline">webhooks</a>).</li>
          <li>If the new token fails, click "Revoke existing" + mint again.</li>
        </ol>
      </div>
    </div>
  );
}
