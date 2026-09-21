import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - Adziga",
  description: "End-user and API documentation for the Adziga marketing operating system."
};

const SECTIONS = [
  {
    title: "Getting started",
    items: [
      { href: "/docs#quickstart", label: "Quickstart (5-minute setup)" },
      { href: "/docs#first-campaign", label: "Create your first campaign" },
      { href: "/docs#invite-team", label: "Invite your team" }
    ]
  },
  {
    title: "Modules",
    items: [
      { href: "/app/leads", label: "Leads & CRM" },
      { href: "/app/campaigns", label: "Campaigns" },
      { href: "/app/clients", label: "Clients" },
      { href: "/app/creatives", label: "Creatives" },
      { href: "/app/events", label: "Events" },
      { href: "/app/influencers", label: "Influencers" },
      { href: "/app/strategy", label: "Strategy" },
      { href: "/app/orchestrate", label: "Orchestration" },
      { href: "/app/automations", label: "Automations" },
      { href: "/app/reports", label: "Reports" },
      { href: "/app/experiments", label: "Experiments" }
    ]
  },
  {
    title: "Intelligence",
    items: [
      { href: "/app/analytics", label: "Analytics" },
      { href: "/app/intelligence", label: "Intelligence hub" },
      { href: "/app/intelligence/strategy", label: "Strategy intelligence (Ziga Plus)" },
      { href: "/app/intelligence/content", label: "Content intelligence (Pro+)" },
      { href: "/app/ai", label: "AI Assistant" }
    ]
  },
  {
    title: "Admin",
    items: [
      { href: "/app/admin", label: "Admin home" },
      { href: "/app/admin/billing", label: "Billing & plans" },
      { href: "/app/admin/integrations", label: "Integrations" },
      { href: "/app/audit", label: "Audit log" }
    ]
  },
  {
    title: "API",
    items: [
      { href: "/api/health", label: "GET /api/health (status check)" },
      { href: "/docs#api-analytics", label: "POST /api/analytics/* (5 deep analytics endpoints)" },
      { href: "/docs#api-ai", label: "POST /api/ai/ask (AI assistant)" },
      { href: "/docs#api-webhooks", label: "POST /api/webhooks/{razorpay,meta}" }
    ]
  },
  {
    title: "Reference",
    items: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/refund", label: "Refund Policy" },
      { href: "/.well-known/security.txt", label: "Security disclosure" }
    ]
  }
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-500 hover:text-brand-600">← Back to Adziga</Link>
        <h1 className="text-4xl font-display font-semibold text-ink-900 mt-6 mb-2">
          Adziga Documentation
        </h1>
        <p className="text-ink-600 text-lg mb-12">
          Everything you need to run marketing operations on Adziga.
        </p>

        {/* Quickstart */}
        <section id="quickstart" className="mb-12">
          <h2 className="text-2xl font-display font-semibold text-ink-900 mb-3">
            Quickstart
          </h2>
          <p className="text-ink-700 mb-4">
            Adziga is built around three primitives: <strong>Clients</strong> (the companies you serve),
            <strong> Campaigns</strong> (their marketing initiatives), and <strong>Leads</strong> (inbound interest).
            Everything else (creatives, events, influencers, automations) hangs off these three.
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-ink-700">
            <li>
              Create your organization on signup — you become the Founder. Add a colleague as Admin or
              Marketing Manager.
            </li>
            <li id="first-campaign">
              Open <Link href="/app/clients" className="text-brand-600 hover:underline">Clients</Link> and
              add your first client (or skip this if you're using Adziga for your own brand).
            </li>
            <li>
              Create a campaign from <Link href="/app/campaigns/new" className="text-brand-600 hover:underline">Campaigns → New</Link>.
              Pick platform, objective, budget, and dates.
            </li>
            <li>
              Push a creative (image or video) from{" "}
              <Link href="/app/creatives" className="text-brand-600 hover:underline">Creatives</Link>{" "}
              and link it to the campaign.
            </li>
            <li>
              Leads start landing in <Link href="/app/leads" className="text-brand-600 hover:underline">Leads</Link>.
              Use the AI Assistant to ask why CPL is high or which channel performs best.
            </li>
            <li id="invite-team">
              Invite teammates from <Link href="/app/admin" className="text-brand-600 hover:underline">Admin</Link>.
              Roles: Founder, Admin, Marketing Manager, Content Team, Finance, Sales, Client Admin, Client Member.
            </li>
          </ol>
        </section>

        {/* Reference grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-display font-semibold text-ink-900 mb-3 pb-2 border-b border-ink-200">
                {s.title}
              </h2>
              <ul className="space-y-2">
                {s.items.map((it) => (
                  <li key={it.href + it.label}>
                    <Link href={it.href} className="text-ink-700 hover:text-brand-600 text-sm">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* API details */}
        <section id="api-analytics" className="mt-16">
          <h2 className="text-2xl font-display font-semibold text-ink-900 mb-3">
            Analytics endpoints
          </h2>
          <p className="text-ink-700 mb-4">
            All five analytics endpoints return JSON. Auth is via session cookie (cookie-based)
            — same as the rest of the app. Org scope is enforced server-side.
          </p>
          <div className="space-y-3">
            {[
              { path: "/api/analytics/mmm", body: '{ "days": 90 }', desc: "Marketing Mix Model — Ridge regression with adstock transformation, plus recommended reallocation." },
              { path: "/api/analytics/attribution", body: '{ "days": 90, "leadIds": [...] }', desc: "Multi-touch attribution using exact Shapley values across all touchpoints." },
              { path: "/api/analytics/score-leads", body: '{ "limit": 100 }', desc: "Predictive lead scoring — logistic regression with 19-dim feature vector + Platt scaling." },
              { path: "/api/analytics/optimize-budget", body: '{ "totalBudget": 50000, "days": 30 }', desc: "Multi-armed bandit with Thompson Sampling (5000 iterations, Marsaglia-Tsang Gamma sampling)." },
              { path: "/api/analytics/anomalies", body: '{ "days": 30, "threshold": 3 }', desc: "Z-score anomaly detection with rolling baseline + domain-aware action suggestions." }
            ].map((r) => (
              <div key={r.path} className="border border-ink-200 rounded-lg p-4 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-ink-100 text-ink-700 px-2 py-0.5 rounded">POST</span>
                  <code className="text-sm text-ink-900">{r.path}</code>
                </div>
                <p className="text-sm text-ink-700 mb-2">{r.desc}</p>
                <pre className="text-xs bg-ink-900 text-ink-100 rounded p-2 overflow-x-auto"><code>{r.body}</code></pre>
              </div>
            ))}
          </div>
        </section>

        <section id="api-ai" className="mt-12">
          <h2 className="text-2xl font-display font-semibold text-ink-900 mb-3">
            AI Assistant endpoint
          </h2>
          <p className="text-ink-700 mb-3">
            The assistant answers questions using MMM, attribution, and lead scoring as ground truth.
            Live LLM (Gemini 2.5 Flash) when <code className="text-sm bg-ink-100 px-1 rounded">GEMINI_API_KEY</code> is set;
            deterministic stub otherwise. Both modes return analyticsUsed metadata.
          </p>
          <div className="border border-ink-200 rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono bg-ink-100 text-ink-700 px-2 py-0.5 rounded">POST</span>
              <code className="text-sm text-ink-900">/api/ai/ask</code>
            </div>
            <pre className="text-xs bg-ink-900 text-ink-100 rounded p-2 overflow-x-auto"><code>{`{
  "question": "Which channel should I double down on?",
  "clientId": "optional-org-id"
}`}</code></pre>
          </div>
        </section>

        <section id="api-webhooks" className="mt-12 mb-12">
          <h2 className="text-2xl font-display font-semibold text-ink-900 mb-3">
            Webhooks
          </h2>
          <p className="text-ink-700 mb-3">
            <strong>Razorpay</strong> subscriptions fire on <code className="text-sm bg-ink-100 px-1 rounded">/api/webhooks/razorpay</code>.
            HMAC SHA-256 signed via <code className="text-sm bg-ink-100 px-1 rounded">x-razorpay-signature</code> header.
            Idempotency via PaymentEvent.providerId unique constraint. Tier changes, invoice creation,
            subscription cancellation, and payment failure are all written to AuditLog.
          </p>
          <p className="text-ink-700">
            <strong>Meta</strong> Conversions API leads arrive on{" "}
            <code className="text-sm bg-ink-100 px-1 rounded">/api/webhooks/meta</code>. HMAC SHA-256 signed
            via <code className="text-sm bg-ink-100 px-1 rounded">x-hub-signature-256</code>.
          </p>
        </section>

        <div className="border-t border-ink-200 pt-8 mt-16 flex items-center justify-between text-sm">
          <span className="text-ink-500">Need more help? Email <a href="mailto:support@adziga.in" className="hover:text-brand-600">support@adziga.in</a></span>
          <Link href="/" className="text-ink-500 hover:text-brand-600">← Home</Link>
        </div>
      </div>
    </main>
  );
}
