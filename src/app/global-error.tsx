"use client";

import Link from "next/link";

// Global fallback — catches errors in root layout itself.
// Renders full HTML because the root layout likely failed.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-ink-50 min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="text-7xl font-display font-semibold text-brand-600 mb-2">500</p>
          <h1 className="text-2xl font-display font-semibold text-ink-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-ink-600 mb-2">
            We've logged this and the team has been notified.
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
            <Link href="/" className="btn btn-ghost btn-sm">
              Back to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
