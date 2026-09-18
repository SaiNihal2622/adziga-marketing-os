import { ResetForm } from "./form";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
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
        <div className="relative space-y-4 max-w-md">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Choose a new password.
          </h1>
          <p className="text-ink-300 text-base leading-relaxed">
            For your security, we'll sign out all devices after a password reset.
          </p>
        </div>
        <div className="relative text-xs text-ink-400">
          © {new Date().getFullYear()} Adziga · <Link href="/" className="hover:text-ink-200">adziga.in</Link>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-4 justify-center">
            <Logo />
            <span className="font-semibold">Adziga</span>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reset your password</h2>
            <p className="text-sm text-ink-500 mt-1">Pick a new password for your account.</p>
          </div>
          <ResetForm token={token} />
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
