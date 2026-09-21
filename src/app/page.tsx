import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PLATFORM_LABELS, TIER_LABELS, TIER_FEATURES } from "@/lib/constants";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-white text-ink-900">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="icon" size={32} theme="light" />
            <span className="font-semibold text-lg tracking-tight">Adziga</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-600">
            <Link href="#platform" className="hover:text-ink-900 transition-colors">Platform</Link>
            <Link href="#tiers" className="hover:text-ink-900 transition-colors">Pricing</Link>
            <Link href="#integrations" className="hover:text-ink-900 transition-colors">Integrations</Link>
            <Link href="#roadmap" className="hover:text-ink-900 transition-colors">Roadmap</Link>
            <Link href="/docs" className="hover:text-ink-900 transition-colors">Docs</Link>
            <Link href="/contact" className="hover:text-ink-900 transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Get started free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-ink-50/50 to-white">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-200 bg-white text-xs text-ink-600 mb-8 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Phase 0 → Phase 4 shipped · v1.0 GA</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6">
              Marketing as a{" "}
              <span className="gradient-text">decision intelligence</span>{" "}
              system.
            </h1>

            <p className="text-lg md:text-xl text-ink-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              Adziga connects strategy, campaign execution, lead management, creative production, analytics, and reporting into one continuous system — built for teams that treat marketing as infrastructure, not magic.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="btn btn-primary text-base px-6 py-3">
                Start free — no card needed
                <Arrow />
              </Link>
              <Link href="/login" className="btn btn-outline text-base px-6 py-3">
                <Play />
                Live demo
              </Link>
            </div>

            <p className="mt-6 text-xs text-ink-500">
              14 modules · Multi-tenant · Real API connectors · Open audit trail
            </p>
          </div>

          {/* Flywheel */}
          <div className="mt-20 card p-8 max-w-5xl mx-auto fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xs uppercase tracking-wide font-semibold text-ink-500">The Adziga flywheel</div>
              <div className="text-xs text-ink-400">Every campaign generates training data for the next</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                ["Strategy", "Human-authored", "◎"],
                ["Execution", "Multi-channel", "▣"],
                ["Data", "Structured, attributable", "▦"],
                ["Measurement", "CPL · CAC · ROAS", "△"],
                ["Learning", "Decision log + experiments", "◇"],
                ["Better Strategy", "Compounding edge", "✦"]
              ].map(([title, sub, icon]) => (
                <div key={title} className="card p-4 border-ink-200 hover-lift text-center">
                  <div className="text-2xl mb-2 gradient-text">{icon}</div>
                  <div className="font-semibold text-sm">{title}</div>
                  <div className="text-xs text-ink-500 mt-1">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Social proof */}
      <section className="border-y border-ink-100 py-12 bg-ink-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center text-xs uppercase tracking-wide font-semibold text-ink-500 mb-6">
            Built for marketing teams who run real campaigns at scale
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center opacity-60">
            {["RealtyCo", "FinRise Capital", "FinBridge", "PropStream", "WealthLab", "EduSphere"].map((logo) => (
              <div key={logo} className="text-center font-mono text-sm font-semibold">{logo}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="platform" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">The Platform</div>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Every marketing module. One system.</h2>
            <p className="text-ink-600 max-w-2xl mx-auto">14 modules, fully integrated. No tab-switching between 7 SaaS tools.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "◎", name: "Overview", desc: "Marketing command center with KPIs, funnel, alerts, and trend lines." },
              { icon: "▣", name: "Campaigns", desc: "Multi-channel workflow: Draft → Review → Approved → Active → Paused → Completed." },
              { icon: "◇", name: "Strategy", desc: "Versioned strategies with author, approver, change reason. Foundation for future AI." },
              { icon: "▤", name: "Creatives", desc: "Centralized library. Hook, headline, copy, CTA, audience — all stored with performance." },
              { icon: "↘", name: "Leads + CRM", desc: "Full lifecycle: New → Contacted → Qualified → Meeting → Proposal → Won/Lost." },
              { icon: "✦", name: "Events", desc: "Online + offline marketing events with full funnel + registration." },
              { icon: "◐", name: "Influencers", desc: "Creator campaigns with unique tracking tokens, attribution, ROI calc." },
              { icon: "△", name: "Experiments", desc: "Hypothesis-driven A/B with control, treatment, expected vs actual, conclusion." },
              { icon: "▦", name: "Analytics", desc: "Unified metrics: CPL, CAC, ROAS. Channel breakdown, period filters." },
              { icon: "▢", name: "Reports", desc: "Client-facing reports with 8 sections including Recommendations + Next Actions." },
              { icon: "✸", name: "AI Assistant", desc: "Controlled-context Q&A with audit trail. Refuses to execute changes autonomously." },
              { icon: "↻", name: "Automations", desc: "Workflow engine: triggers + conditions + actions. Lead scoring, assignment, alerts." }
            ].map((m) => (
              <div key={m.name} className="card p-5 hover-lift">
                <div className="text-2xl mb-2 gradient-text">{m.icon}</div>
                <div className="font-semibold mb-1">{m.name}</div>
                <div className="text-sm text-ink-600">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* v0-style bento grid — feature highlights with mixed sizes */}
      <section className="py-24 bg-gradient-to-b from-white to-ink-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Why Adziga</div>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Built for teams who treat marketing as infrastructure.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
            {/* Big card — span 2 */}
            <div className="md:col-span-2 card-v0 p-8 relative overflow-hidden hover-overlay-host group">
              <div className="absolute inset-0 bg-bento opacity-30" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Audit trail</div>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Every decision, every change — recorded.</h3>
                <p className="text-sm text-ink-600 max-w-md mb-4">
                  Every campaign edit, lead score, strategy revision, automation trigger, and AI suggestion gets a timestamped audit entry. SOC 2-ready by default.
                </p>
                <div className="flex gap-2">
                  <span className="badge badge-brand">Phase 0</span>
                  <span className="badge badge-neutral">Append-only</span>
                  <span className="badge badge-neutral">Exportable</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="card-v0 p-6 relative overflow-hidden hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-20" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-accent-600 mb-2">Phase 4</div>
                <h3 className="text-lg font-bold tracking-tight mb-2">Marketing Orchestration</h3>
                <p className="text-sm text-ink-600">
                  Set a goal. Get a plan. Approve. Deploy — across Meta, Google, WhatsApp, email, in one click.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="card-v0 p-6 relative overflow-hidden hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-20" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-emerald-600 mb-2">Real connectors</div>
                <h3 className="text-lg font-bold tracking-tight mb-2">No sandbox mode</h3>
                <p className="text-sm text-ink-600">
                  Paste your Meta / Google / WhatsApp credentials and the live API kicks in immediately. No demo data.
                </p>
              </div>
            </div>

            {/* Big card 2 — span 2 */}
            <div className="md:col-span-2 card-v0 p-8 relative overflow-hidden bg-ink-950 text-white hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-30" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-accent-400 mb-2 tabular-nums">02 — Intelligence</div>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Strategy & Content intelligence baked in.</h3>
                <p className="text-sm text-ink-300 max-w-md mb-4">
                  70/30 blend of your own history and industry benchmarks tells you which channels to push and which creatives are working. No data scientist required.
                </p>
                <div className="flex gap-3 items-center">
                  <div className="text-xs text-ink-400 tabular-nums">12 benchmarks</div>
                  <span className="text-ink-700">·</span>
                  <div className="text-xs text-ink-400 tabular-nums">13 patterns</div>
                  <span className="text-ink-700">·</span>
                  <div className="text-xs text-ink-400 tabular-nums">6 channels</div>
                </div>
              </div>
            </div>

            {/* Card 5 */}
            <div className="card-v0 p-6 relative overflow-hidden hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-20" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Multi-tenant</div>
                <h3 className="text-lg font-bold tracking-tight mb-2">Built for agencies</h3>
                <p className="text-sm text-ink-600">
                  One org per client. Strict data isolation. Per-client RBAC. White-label ready.
                </p>
              </div>
            </div>

            {/* Card 6 */}
            <div className="card-v0 p-6 relative overflow-hidden hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-20" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-emerald-600 mb-2">Open API</div>
                <h3 className="text-lg font-bold tracking-tight mb-2">Everything is an endpoint.</h3>
                <p className="text-sm text-ink-600">
                  25+ REST endpoints. Zod-validated, audit-logged, rate-limited. Build on top of Adziga.
                </p>
              </div>
            </div>

            {/* Card 7 */}
            <div className="card-v0 p-6 relative overflow-hidden hover-overlay-host">
              <div className="absolute inset-0 bg-bento opacity-20" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Compliance</div>
                <h3 className="text-lg font-bold tracking-tight mb-2">India + global</h3>
                <p className="text-sm text-ink-600">
                  Razorpay billing, INR pricing, GST invoices. GDPR + DPDP-ready data export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tiers" className="py-24 bg-ink-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Pricing</div>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Three tiers. Pick the one that matches your stage.</h2>
            <p className="text-ink-600 max-w-2xl mx-auto">All tiers include every module. Tiers unlock scale and intelligence depth.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {([
              { tier: "FREE", label: "Free", highlight: false, cta: "Start free", desc: "Forever free for solo marketers and small teams." },
              { tier: "PRO", label: "Pro", highlight: true, cta: "Start Pro trial", desc: "For agencies and growing businesses." },
              { tier: "ZIGA_PLUS", label: "Ziga Plus", highlight: false, cta: "Contact sales", desc: "Enterprise scale + orchestration." }
            ] as const).map(({ tier, label, highlight, cta, desc }) => {
              const features = TIER_FEATURES[tier as keyof typeof TIER_FEATURES];
              const price = tier === "FREE" ? "0" : tier === "PRO" ? "4,900" : "24,900";
              return (
                <div key={tier} className={`card p-6 relative ${highlight ? "ring-2 ring-brand-500 scale-105" : ""}`}>
                  {highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="badge badge-brand">Most Popular</span>
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wide font-semibold text-ink-500 mb-1">{label}</div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold">INR {price}</span>
                    <span className="text-sm text-ink-500">/month</span>
                  </div>
                  <p className="text-sm text-ink-600 mb-5">{desc}</p>
                  <ul className="space-y-2 text-sm mb-6">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={tier === "ZIGA_PLUS" ? "/contact" : "/signup"} className={`w-full text-center ${highlight ? "btn btn-primary" : "btn btn-secondary"}`}>
                    {cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-wide font-semibold text-brand-600 mb-2">Integrations</div>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Every channel. Unified attribution.</h2>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
              <div key={k} className="card p-4 text-center hover-lift">
                <div className="text-sm font-semibold">{v}</div>
                <div className="text-xs text-ink-500 mt-1 font-mono">{k}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-ink-500 mt-6">
            Plus Gemini, Vertex AI, BigQuery, Firebase, Razorpay for billing, and a full REST API.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-950 text-white py-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Stop running marketing in five disconnected tabs.</h2>
          <p className="text-lg text-ink-300 mb-8 max-w-2xl mx-auto">
            Run your strategy, execution, leads, creatives, events, and reports in one auditable system.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="btn btn-primary text-base px-6 py-3">Start free</Link>
            <Link href="/contact" className="btn btn-outline text-base px-6 py-3 border-ink-700 text-white hover:bg-ink-800">Talk to us</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-ink-100 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3"><Logo variant="icon" size={28} theme="light" /></div>
              <p className="text-xs text-ink-500">AI-first Advertising & Marketing Operating System.</p>
            </div>
            <div>
              <div className="text-xs uppercase font-semibold text-ink-500 mb-3">Product</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="#platform" className="text-ink-600 hover:text-ink-900">Platform</Link></li>
                <li><Link href="#tiers" className="text-ink-600 hover:text-ink-900">Pricing</Link></li>
                <li><Link href="#integrations" className="text-ink-600 hover:text-ink-900">Integrations</Link></li>
                <li><Link href="/docs" className="text-ink-600 hover:text-ink-900">Docs</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase font-semibold text-ink-500 mb-3">Company</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-ink-600 hover:text-ink-900">Contact</Link></li>
                <li><Link href="/terms" className="text-ink-600 hover:text-ink-900">Terms</Link></li>
                <li><Link href="/privacy" className="text-ink-600 hover:text-ink-900">Privacy</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase font-semibold text-ink-500 mb-3">Sign in</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="text-ink-600 hover:text-ink-900">Login</Link></li>
                <li><Link href="/signup" className="text-ink-600 hover:text-ink-900">Create account</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
            <div>© {new Date().getFullYear()} Adziga · Built in India · All rights reserved.</div>
            <div className="flex items-center gap-4">
              <Link href="/legal/terms" className="hover:text-ink-900">Terms</Link>
              <Link href="/legal/privacy" className="hover:text-ink-900">Privacy</Link>
              <Link href="/legal/refund" className="hover:text-ink-900">Refund</Link>
              <span>Made for marketing teams who ship.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Check() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 text-emerald-600 shrink-0"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Arrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Play() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}