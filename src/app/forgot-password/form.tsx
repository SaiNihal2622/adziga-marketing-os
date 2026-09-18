"use client";

import { useState } from "react";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm">
        <div className="font-semibold text-emerald-700 mb-1">Check your email</div>
        <div className="text-emerald-600">If an account exists for that email, we sent a password reset link.</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@company.com"
          autoComplete="email"
        />
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}