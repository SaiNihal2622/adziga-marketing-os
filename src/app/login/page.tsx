import { LoginForm } from "./login-form";
import Link from "next/link";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md card p-8">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 13L9 7L13 11L21 3" stroke="#243ff0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="2" fill="#243ff0" />
              <circle cx="13" cy="11" r="2" fill="#243ff0" />
              <circle cx="21" cy="3" r="2" fill="#d946ef" />
            </svg>
            <span className="font-semibold">Adziga</span>
          </Link>
          <h1 className="text-xl font-semibold">Sign in to your workspace</h1>
          <p className="text-sm text-ink-500 mt-1">
            Continue with your Adziga credentials.
          </p>
        </div>
        <LoginForm />
        <div className="mt-6 pt-6 border-t border-ink-200 text-xs text-ink-500">
          <p className="font-semibold mb-2">Demo logins (dev seed):</p>
          <ul className="space-y-1 font-mono">
            <li>super@adziga.in / adziga123</li>
            <li>admin@adziga.in / adziga123</li>
            <li>mm@adziga.in / adziga123</li>
            <li>cm@adziga.in / adziga123</li>
            <li>sales@adziga.in / adziga123</li>
            <li>finance@adziga.in / adziga123</li>
            <li>content@adziga.in / adziga123</li>
            <li>client@acme.in / adziga123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}