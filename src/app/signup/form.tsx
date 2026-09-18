"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, orgName })
    });
    setLoading(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.message ?? "Signup failed");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login?verify=1"), 3000);
  }

  if (success) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm">
        <div className="font-semibold text-emerald-700 mb-1">Check your email</div>
        <div className="text-emerald-600">We sent a verification link to <strong>{email}</strong>. Click it to activate your account.</div>
        <div className="text-xs text-ink-500 mt-2">Redirecting to login...</div>
      </div>
    );
  }

  const passwordOk = password.length >= 8;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Your name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Sai Nihal"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="label">Work email</label>
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
      <div>
        <label className="label">Workspace / company name</label>
        <input
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="input"
          placeholder="Acme Realty"
        />
        <p className="text-[11px] text-ink-500 mt-1">
          This will be your org slug ({orgName ? orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "your-org"}.adziga.in)
        </p>
      </div>
      <div>
        <label className="label">Password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <p className={`text-[11px] mt-1 ${passwordOk ? "text-emerald-600" : "text-ink-500"}`}>
          {passwordOk ? "✓ Looks good (8+ characters)" : "At least 8 characters"}
        </p>
      </div>

      {error && (
        <div className="badge badge-danger w-full justify-start py-1.5 text-xs">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading || !passwordOk}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {loading ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}