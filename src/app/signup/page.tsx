import { SignupForm } from "./form";
import { Logo } from "@/components/brand/logo";
import Link from "next/link";

export const metadata = { title: "Create your Adziga account" };
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Brand panel — left */}
      <aside className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-bento opacity-30" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl" />

        <div className="relative">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="icon" size={40} theme="dark" />
          </Link>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Start free.{" "}
            <span className="gradient-text">No card needed.</span>
          </h1>
          <p className="text-ink-300 text-base max-w-md leading-relaxed">
            Spin up your Adziga workspace in 60 seconds. All 14 modules on the free tier. Upgrade only when you need scale or intelligence depth.
          </p>

          <div className="space-y-3">
            <Step n={1} title="Create your workspace" desc="Just an email, name, and company name. We'll provision your org + dashboard." />
            <Step n={2} title="Connect your channels" desc="One-click Meta, Google, WhatsApp, Razorpay integrations. Or use the API." />
            <Step n={3} title="Run your first campaign" desc="Use Phase 4 orchestration — set a goal, approve the plan, deploy." />
          </div>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-ink-400">
          <span>© {new Date().getFullYear()} Adziga</span>
          <span className="text-ink-700">·</span>
          <Link href="/" className="hover:text-ink-200 transition-colors">adziga.in</Link>
        </div>
      </aside>

      {/* Form panel — right */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Logo variant="icon" size={36} theme="light" />
          </Link>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Create your workspace</h2>
              <p className="text-sm text-ink-500 mt-1">Free forever · upgrade anytime.</p>
            </div>

            <SignupForm />

            <p className="text-center text-xs text-ink-400 pt-4 hairline-t">
              Already have an account?{" "}
              <Link href="/login" className="text-ink-900 font-medium hover:underline">Sign in →</Link>
            </p>
            <p className="text-center text-[11px] text-ink-400">
              By signing up you agree to our{" "}
              <Link href="/terms" className="hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}


function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 size-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-semibold tabular-nums">{n}</span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ink-400 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
