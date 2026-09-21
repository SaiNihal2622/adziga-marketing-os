"use client";

import Link from "next/link";
import { useEffect } from "react";

// Root app error boundary — wraps every page below /app

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Send to backend so the audit log captures client crashes too
    if (typeof window !== "undefined") {
      try {
        fetch("/api/audit/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            digest: error.digest,
            message: error.message,
            stack: error.stack?.slice(0, 500),
            url: window.location.href,
            ua: navigator.userAgent
          })
        }).catch(() => {});
      } catch {}
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center fade-in">
        <p className="text-7xl font-display font-semibold text-brand-600 mb-2">500</p>
        <h1 className="text-2xl font-display font-semibold text-ink-900 mb-2">
          That page just crashed
        </h1>
        <p className="text-ink-600 mb-2">
          We've logged this. You can try again or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-ink-500 font-mono mb-6">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn btn-primary btn-sm">
            Try again
          </button>
          <Link href="/app/overview" className="btn btn-ghost btn-sm">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
