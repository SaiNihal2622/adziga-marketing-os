"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return <div className="text-sm text-ink-500">Missing reset token.</div>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    setLoading(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.message ?? "Reset failed");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login?reset=1"), 2500);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm">
        <div className="font-semibold text-emerald-700 mb-1">Password reset</div>
        <div className="text-emerald-600">You can now sign in with your new password.</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">New password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          className="input"
          autoComplete="new-password"
        />
      </div>
      {error && (
        <div className="badge badge-danger w-full justify-start py-1.5 text-xs">{error}</div>
      )}
      <button type="submit" disabled={loading || password.length < 8} className="btn btn-primary w-full">
        {loading ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}