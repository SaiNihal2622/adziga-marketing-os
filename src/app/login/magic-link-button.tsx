"use client";

import { useState } from "react";

// Magic-link button — replaces Google OAuth placeholder.
// Sends a one-time sign-in link to the user's email.
// Works with ANY email (production uses Resend/SMTP, demo mode shows the link in-UI).

export function MagicLinkButton({ callbackUrl }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"input" | "sent" | "error">("input");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrMsg(null);
    setDevLink(null);
    try {
      const r = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrMsg(j.message ?? "Could not send sign-in link");
        setStep("error");
        return;
      }
      // In stub/demo mode, the API returns devLink so the demo flow works without SMTP
      if (j.devLink) setDevLink(j.devLink);
      setStep("sent");
    } catch (e: any) {
      setErrMsg(e.message ?? "Network error");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  if (step === "sent") {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm">
        <div className="font-medium text-ink-900">Check your email</div>
        <div className="text-ink-600 mt-1">
          We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
        </div>
        {devLink && (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs">
            <div className="font-semibold text-amber-900 mb-1">Demo mode (no SMTP configured)</div>
            <div className="text-amber-800 mb-1.5">Click below to sign in instantly:</div>
            <a
              href={devLink}
              className="block break-all text-brand-600 hover:underline font-mono"
              target="_self"
            >
              {devLink}
            </a>
          </div>
        )}
        <button
          onClick={() => { setStep("input"); setEmail(""); setDevLink(null); }}
          className="mt-3 text-xs text-ink-500 hover:text-ink-900"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          required
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="input flex-1 focus-ring"
        />
        <button
          type="submit"
          disabled={loading || !email}
          className="btn btn-primary text-sm disabled:opacity-50 focus-ring"
        >
          {loading ? "Sending…" : "Send link"}
        </button>
      </div>
      {errMsg && (
        <div className="text-xs text-danger-600">{errMsg}</div>
      )}
      <div className="text-[11px] text-ink-500 text-center">
        We'll email you a one-time sign-in link. No password needed.
      </div>
    </form>
  );
}
