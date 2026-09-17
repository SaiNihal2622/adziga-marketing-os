import Link from "next/link";
import { PLATFORM_LABELS, TIER_LABELS, TIER_FEATURES } from "@/lib/constants";

export default function MarketingHome() {
  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-ink-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-lg tracking-tight">Adziga</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-700">
            <a href="#platform" className="hover:text-brand-600">Platform</a>
            <a href="#tiers" className="hover:text-brand-600">Tiers</a>
            <a href="#integrations" className="hover:text-brand-600">Integrations</a>
            <a href="#roadmap" className="hover:text-brand-600">Roadmap</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/onboarding" className="btn btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-200 bg-white text-xs text-ink-600 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Phase 0 — Human-led marketing, AI-assisted
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-4xl">
            Marketing as a{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-accent-600">
              decision intelligence
            </span>{" "}
            system.
          </h1>
          <p className="mt-6 text-lg text-ink-600 max-w-2xl">
            Adziga connects strategy, campaign execution, lead management, creative
            production, analytics, and reporting into one continuous system — built for
            teams that treat marketing as infrastructure, not magic.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="btn btn-primary text-base px-6 py-3">
              Start onboarding →
            </Link>
            <Link href="/login" className="btn btn-secondary text-base px-6 py-3">
              Sign in to your org
            </Link>
          </div>

          {/* Flywheel diagram */}
          <div className="mt-16 card p-8">
            <div className="text-xs uppercase tracking-wide font-semibold text-ink-500 mb-6">
              The Adziga flywheel
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
              {[
                ["Strategy", "Human-authored"],
                ["Execution", "Meta · Google · WhatsApp"],
                ["Data", "Structured, attributable"],
                ["Measurement", "CPL · CAC · ROAS"],
                ["Learning", "Decision log + experiments"],
                ["Better Strategy", "Compounding edge"]
              ].map(([title, sub], i) => (
                <div key={title} className="relative card p-4 border-ink-200">
                  <div className="text-xs text-ink-500 mb-1">Step {i + 1}</div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-xs text-ink-500 mt-1">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tier section */}
      <section id="tiers" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-wide font-semibold text-ink-500 mb-2">
            Three tiers — pick the one that matches your stage
          </div>
          <h2 className="text-3xl font-bold">From a marketing assistant to enterprise-grade orchestration.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {(["FREE", "PRO", "ZIGA_PLUS"] as const).map((tier) => (
            <div key={tier} className={`card p-6 ${tier === "PRO" ? "ring-2 ring-brand-500" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`badge ${tier === "FREE" ? "badge-neutral" : tier === "PRO" ? "badge-brand" : "badge-accent"}`}>
                  {tier === "ZIGA_PLUS" ? "Ziga Plus" : tier === "PRO" ? "Pro" : "Free"}
                </span>
                {tier === "PRO" && <span className="text-xs text-brand-600 font-semibold">Recommended</span>}
              </div>
              <h3 className="font-semibold text-lg mt-2">{TIER_LABELS[tier]}</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {TIER_FEATURES[tier].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className={`mt-6 btn w-full ${tier === "PRO" ? "btn-primary" : "btn-secondary"}`}
              >
                {tier === "FREE" ? "Start free" : tier === "PRO" ? "Get Pro" : "Contact sales"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Platforms */}
      <section id="integrations" className="bg-ink-50 border-y border-ink-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-wide font-semibold text-ink-500 mb-2">
              Integration-first architecture
            </div>
            <h2 className="text-3xl font-bold">Every channel feeds the same intelligence.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(PLATFORM_LABELS)).map(([k, v]) => (
              <div key={k} className="card p-4 text-center">
                <div className="text-sm font-semibold">{v}</div>
                <div className="text-xs text-ink-500 mt-1">{k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-wide font-semibold text-ink-500 mb-2">
            Phased evolution — never fake AI
          </div>
          <h2 className="text-3xl font-bold">A system that earns autonomy.</h2>
          <p className="text-ink-600 mt-3 max-w-2xl mx-auto">
            Adziga's current system is human-led. We label deterministic automation, AI
            assistance, AI recommendations, and (future) autonomous decisions distinctly.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["Phase 0", "Now", "Hybrid agency + structured automation + data capture"],
            ["Phase 1", "Next", "Automation engine across Meta, Google, WhatsApp, CRM"],
            ["Phase 2", "Future", "Strategy intelligence (industry × audience × budget)"],
            ["Phase 4", "Eventually", "Marketing orchestration with human approval gates"]
          ].map(([phase, when, desc]) => (
            <div key={phase} className="card p-5">
              <div className="text-xs text-brand-600 font-semibold">{phase}</div>
              <div className="text-sm font-medium mt-1">{when}</div>
              <p className="text-sm text-ink-600 mt-3">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-950 text-white">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Stop running marketing in five disconnected tabs.</h2>
          <p className="text-ink-300 mt-4 max-w-xl mx-auto">
            Run your strategy, execution, leads, creatives, events, and reports in one
            auditable system.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link href="/onboarding" className="btn btn-primary text-base px-6 py-3">Start onboarding</Link>
            <Link href="/login" className="btn btn-secondary text-base px-6 py-3">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 text-sm text-ink-500 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span>© {new Date().getFullYear()} Adziga · AI-first Marketing OS</span>
          </div>
          <div className="flex gap-6">
            <a href="#platform" className="hover:text-brand-600">Platform</a>
            <a href="#tiers" className="hover:text-brand-600">Tiers</a>
            <a href="/login" className="hover:text-brand-600">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 13L9 7L13 11L21 3" stroke="#243ff0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="2" fill="#243ff0" />
      <circle cx="13" cy="11" r="2" fill="#243ff0" />
      <circle cx="21" cy="3" r="2" fill="#d946ef" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 text-brand-600 shrink-0">
      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}