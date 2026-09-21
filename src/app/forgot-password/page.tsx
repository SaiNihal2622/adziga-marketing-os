import { ForgotForm } from "./form";
import { Logo } from "@/components/brand/logo";
import Link from "next/link";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      <aside className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-bento opacity-30" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="icon" size={40} theme="dark" />
          </Link>
        </div>
        <div className="relative space-y-4 max-w-md">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Reset your password.
          </h1>
          <p className="text-ink-300 text-base leading-relaxed">
            Enter your email and we'll send you a reset link. The link expires in 1 hour for security.
          </p>
        </div>
        <div className="relative text-xs text-ink-400">
          © {new Date().getFullYear()} Adziga · <Link href="/" className="hover:text-ink-200">adziga.in</Link>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-4 justify-center">
            <Logo variant="icon" size={36} theme="light" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Forgot your password?</h2>
            <p className="text-sm text-ink-500 mt-1">Enter your email and we'll send you a reset link.</p>
          </div>
          <ForgotForm />
          <p className="text-center text-xs text-ink-400 pt-4 hairline-t">
            Remembered it?{" "}
            <Link href="/login" className="text-ink-900 font-medium hover:underline">Sign in →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}


