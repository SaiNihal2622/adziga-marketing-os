import { LoginForm } from "./login-form";
import { GoogleOAuthButton } from "./google-button";
import Link from "next/link";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { verify?: string; reset?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-6 justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 13L9 7L13 11L21 3" stroke="#243ff0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="2" fill="#243ff0" />
            <circle cx="13" cy="11" r="2" fill="#243ff0" />
            <circle cx="21" cy="3" r="2" fill="#d946ef" />
          </svg>
          <span className="font-semibold text-lg tracking-tight">Adziga</span>
        </Link>

        <div className="card p-8 fade-in">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Sign in</h1>
          <p className="text-sm text-ink-500 mb-6">
            Welcome back. Sign in to your Adziga workspace.
          </p>

          {searchParams.verify && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              ✓ Email verified. You can now sign in.
            </div>
          )}
          {searchParams.reset && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              ✓ Password reset. Sign in with your new password.
            </div>
          )}

          <LoginForm />

          <div className="mt-4 flex items-center justify-between text-xs">
            <Link href="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
            <Link href="/signup" className="text-brand-600 hover:underline">Create account</Link>
          </div>

          {/* OAuth providers */}
          <div className="mt-6 pt-6 border-t border-ink-100">
            <GoogleOAuthButton />
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-400 mt-4">
          Demo logins (dev seed only):<br />
          <span className="font-mono">super@adziga.in / adziga123</span> &middot; <span className="font-mono">mm@adziga.in / adziga123</span>
        </p>
      </div>
    </div>
  );
}