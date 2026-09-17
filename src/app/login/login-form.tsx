"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials. Try a demo login below.");
      return;
    }
    if (res?.ok) {
      router.push(res.url || callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          autoFocus
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@adziga.in"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="badge badge-danger w-full justify-start py-1.5">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-center text-ink-500">
        No account?{" "}
        <a href="/onboarding" className="text-brand-600 hover:underline">
          Start onboarding
        </a>
      </p>
    </form>
  );
}