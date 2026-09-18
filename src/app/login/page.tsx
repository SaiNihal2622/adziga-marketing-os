import { LoginForm } from "./login-form";
import { MagicLinkButton } from "./magic-link-button";
import Link from "next/link";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { verify?: string; reset?: string } }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Brand panel — left half, v0-style with glow + feature highlights */}
      <aside className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-bento opacity-30" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl" />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-lg tracking-tight">Adziga</span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Marketing as a{" "}
            <span className="gradient-text">decision intelligence</span>{" "}
            system.
          </h1>
          <p className="text-ink-300 text-base max-w-md leading-relaxed">
            Run strategy, campaigns, leads, creatives, events, and reports in one auditable system. Built for teams who treat marketing as infrastructure.
          </p>

          <ul className="space-y-3 text-sm">
            {[
              "14 modules — multi-tenant, audit-trailed",
              "Real API connectors (Meta, Google, WhatsApp, Gemini)",
              "Controlled AI assistant with full audit log"
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-ink-200">
                <Check />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-ink-400">
          <span>© {new Date().getFullYear()} Adziga</span>
          <span className="text-ink-700">·</span>
          <Link href="/" className="hover:text-ink-200 transition-colors">adziga.in</Link>
        </div>
      </aside>

      {/* Form panel — right half */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Logo />
            <span className="font-semibold text-lg tracking-tight">Adziga</span>
          </Link>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-sm text-ink-500 mt-1">Sign in to your Adziga workspace.</p>
            </div>

            {searchParams.verify && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 fade-in">
                ✓ Email verified. You can now sign in.
              </div>
            )}
            {searchParams.reset && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 fade-in">
                ✓ Password reset. Sign in with your new password.
              </div>
            )}

            <LoginForm />

            <div className="flex items-center justify-between text-xs">
              <Link href="/forgot-password" className="text-ink-500 hover:text-ink-900 transition-colors">Forgot password?</Link>
              <Link href="/signup" className="text-ink-900 font-medium hover:underline">Create account →</Link>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                <span className="bg-white px-2 text-ink-500">or</span>
              </div>
            </div>

            <MagicLinkButton callbackUrl="/app" />

            <div className="text-center text-[11px] text-ink-400 pt-4 hairline-t">
              Demo logins (dev seed):<br />
              <code className="font-mono text-ink-600">super@adziga.in</code> · <code className="font-mono text-ink-600">adziga123</code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 13L9 7L13 11L21 3" stroke="#5a85ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="2" fill="#5a85ff" />
      <circle cx="13" cy="11" r="2" fill="#5a85ff" />
      <circle cx="21" cy="3" r="2" fill="#d946ef" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-emerald-400">
      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
