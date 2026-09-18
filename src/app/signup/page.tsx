import { SignupForm } from "./form";
import Link from "next/link";

export const metadata = { title: "Create your Adziga account" };
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50 px-4 py-12">
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
          <h1 className="text-2xl font-bold tracking-tight mb-1">Start your free Adziga workspace</h1>
          <p className="text-sm text-ink-500 mb-6">
            No credit card required. Free tier with all 14 modules. Upgrade anytime.
          </p>
          <SignupForm />
        </div>

        <p className="text-center text-sm text-ink-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-ink-400 mt-4">
          By signing up you agree to our{" "}
          <Link href="/terms" className="hover:underline">Terms</Link> and{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}