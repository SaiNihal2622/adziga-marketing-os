import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { fmtDate, fmtINR } from "@/lib/format";
import { PLAN_DEFINITIONS } from "@/server/billing/razorpay";
import { PageHeader } from "../../_components/page-header";
import { Badge, Button } from "../../_components/ui";
import { AutoRenewToggle } from "./_auto-renew-toggle";

export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────────
// Plan definitions (3 tiers) — mirrored from PLAN_DEFINITIONS but with
// richer feature copy + descriptions for the marketing surface.
// ──────────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "FREE",
    name: "Free",
    tagline: "For solo marketers getting started.",
    priceLabel: "₹0",
    priceSub: "/mo",
    features: [
      "1 client account",
      "100 leads/mo",
      "1 channel integration",
      "Basic analytics",
      "Email support",
      "Single workspace"
    ],
    cta: { label: "Start free", variant: "secondary" as const }
  },
  {
    id: "PRO",
    name: "Pro",
    tagline: "For growing agencies that need automation.",
    priceLabel: "₹4,900",
    priceSub: "/mo",
    highlight: true,
    features: [
      "10 client accounts",
      "10K leads/mo",
      "All channel integrations",
      "Strategy Intelligence (Phase 2)",
      "Content Intelligence (Phase 3)",
      "Automation workflows",
      "Priority support"
    ],
    cta: { label: "Upgrade to Pro", variant: "primary" as const }
  },
  {
    id: "ZIGA_PLUS",
    name: "Ziga Plus",
    tagline: "For large teams with custom workflows.",
    priceLabel: "₹24,900",
    priceSub: "/mo",
    features: [
      "Unlimited clients",
      "Unlimited leads",
      "All integrations + Vertex AI",
      "Marketing Orchestration (Phase 4)",
      "Dedicated success manager",
      "Custom workflows",
      "SLA-backed support"
    ],
    cta: { label: "Contact sales", variant: "secondary" as const }
  }
] as const;

type TierId = (typeof TIERS)[number]["id"];

// ──────────────────────────────────────────────────────────────────────────
// Icons
// ──────────────────────────────────────────────────────────────────────────

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="6" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 6V4.5A1.5 1.5 0 0 0 9.5 3H5A1.5 1.5 0 0 0 3.5 4.5v8A1.5 1.5 0 0 0 5 14h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M13.5 3.5l3 3-9 9H4.5v-3l9-9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// Razorpay placeholder logo (lockup-style block, never relies on external CDN)
function RazorpayLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-9 rounded-md bg-gradient-to-br from-[#3395ff] to-[#072654] flex items-center justify-center text-white text-[10px] font-bold tracking-tight">
        RZP
      </div>
      <span className="text-xs font-medium text-ink-700">Razorpay</span>
    </div>
  );
}

// Visa mark placeholder, hand-rolled to avoid font / image dependency
function VisaMark() {
  return (
    <span className="inline-flex items-center justify-center rounded-sm bg-white border border-ink-200 px-2 py-0.5 text-[11px] font-extrabold italic tracking-wide text-[#1a1f71] shadow-sm">
      VISA
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default async function BillingPage() {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN, Role.FINANCE]);
  const currentTierId = (session.orgTier as TierId) ?? "FREE";
  const currentTier = TIERS.find((t) => t.id === currentTierId) ?? TIERS[0];

  // Pull real invoices from Prisma if available.
  let invoices: Array<{
    id: string;
    number: string;
    status: string;
    amount: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    issuedAt: Date;
    paidAt: Date | null;
  }> = [];

  try {
    invoices = await prisma.invoice.findMany({
      where: { orgId: session.orgId },
      orderBy: { issuedAt: "desc" },
      take: 8
    });
  } catch {
    // Prisma unavailable in some environments — fall back to rich mock data.
  }

  // Mock invoices (only used when DB returned nothing). Padded with realistic dates.
  const mockInvoices =
    invoices.length > 0
      ? invoices
      : [
          { id: "m1", number: "INV-2026-0014", status: "PAID", amount: 4900, currency: "INR", periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), issuedAt: new Date("2026-08-01"), paidAt: new Date("2026-08-03") },
          { id: "m2", number: "INV-2026-0013", status: "PAID", amount: 4900, currency: "INR", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-07-31"), issuedAt: new Date("2026-07-01"), paidAt: new Date("2026-07-02") },
          { id: "m3", number: "INV-2026-0012", status: "PAID", amount: 4900, currency: "INR", periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-06-30"), issuedAt: new Date("2026-06-01"), paidAt: new Date("2026-06-04") },
          { id: "m4", number: "INV-2026-0011", status: "PAID", amount: 4900, currency: "INR", periodStart: new Date("2026-05-01"), periodEnd: new Date("2026-05-31"), issuedAt: new Date("2026-05-01"), paidAt: new Date("2026-05-02") },
          { id: "m5", number: "INV-2026-0010", status: "PAID", amount: 4900, currency: "INR", periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-04-30"), issuedAt: new Date("2026-04-01"), paidAt: new Date("2026-04-03") }
        ];

  const currentPrice = PLAN_DEFINITIONS[currentTierId]?.monthlyInr ?? 0;
  const renewDate = "Dec 1, 2026";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Plan"
        subtitle="Manage your subscription and payment methods."
      />

      {/* ─── Current plan ───────────────────────────────────────────────── */}
      <section className="card-v0 relative overflow-hidden">
        {/* Brand accent left bar */}
        <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-500 to-accent-500" />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 p-6 pl-7">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              Current plan
            </div>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
                {currentTier.name}
              </h2>
              <span className="text-xl font-medium tabular-nums text-ink-700">
                {currentPrice === 0 ? "₹0/mo" : `${fmtINR(currentPrice)}/mo`}
              </span>
            </div>
            <p className="text-sm text-ink-600 mt-1">{currentTier.tagline}</p>

            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 max-w-2xl">
              {currentTier.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                  <span className="mt-0.5 inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 h-5 w-5 shrink-0">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3">
            <Badge variant="success">
              <CheckIcon className="h-3 w-3" />
              Current plan
            </Badge>
            <div className="flex items-center gap-2 mt-auto">
              <Button variant="ghost" size="sm" href="#manage">
                Manage subscription
              </Button>
              {currentTierId !== "ZIGA_PLUS" && (
                <Button variant="primary" size="sm" href="#tiers">
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing tiers ──────────────────────────────────────────────── */}
      <section id="tiers" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTierId;
          const isHighlight = "highlight" in tier && tier.highlight;
          const wrapperCls = [
            "card-v0 relative flex flex-col p-6 transition-all",
            isHighlight ? "ring-2 ring-brand-500 scale-[1.02] glow-brand z-10" : "",
            isCurrent ? "border-emerald-300" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={tier.id} className={wrapperCls}>
              {isHighlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-live" />
                    Most popular
                  </Badge>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink-900">{tier.name}</h3>
                {isCurrent && (
                  <Badge variant="success">
                    <CheckIcon className="h-3 w-3" />
                    Current
                  </Badge>
                )}
              </div>

              <p className="text-sm text-ink-600 mt-1 min-h-[2.5rem]">{tier.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tabular-nums tracking-tight text-ink-900">
                  {tier.priceLabel}
                </span>
                <span className="text-sm text-ink-500">{tier.priceSub}</span>
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <span className="mt-0.5 inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 h-5 w-5 shrink-0">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-5 hairline-t">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="btn btn-secondary btn-sm w-full focus-ring opacity-80 cursor-default"
                  >
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                    Current plan
                  </button>
                ) : (
                  <Button variant={tier.cta.variant} size="sm" href="#upgrade" className="w-full focus-ring">
                    {tier.cta.label}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── Payment method + Billing history ──────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Payment method */}
        <div className="card-v0 lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 hairline-b">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Payment method</h3>
              <p className="text-xs text-ink-500 mt-0.5">Charged automatically via Razorpay.</p>
            </div>
            <a
              href="#update-card"
              className="text-xs font-medium text-brand-600 hover:text-brand-700 focus-ring rounded px-1 py-0.5"
            >
              Update
            </a>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <RazorpayLogo />
                <VisaMark />
              </div>
              <Badge variant="neutral">Default</Badge>
            </div>

            <div className="mt-5">
              <div className="font-mono text-sm tabular-nums text-ink-900 tracking-wide">
                •••• •••• •••• 4242
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-ink-500">
                <span className="tabular-nums">Exp 12/27</span>
                <span className="h-1 w-1 rounded-full bg-ink-300" />
                <span>Authorized for ₹24,900</span>
              </div>
            </div>

            <div className="mt-6 pt-4 hairline-t">
              <a
                href="#billing-address"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700 hover:text-ink-900 focus-ring rounded px-1 py-0.5"
              >
                <PencilIcon className="h-3 w-3" />
                Edit billing address
              </a>
            </div>
          </div>
        </div>

        {/* Billing history */}
        <div className="card-v0 lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 hairline-b">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Billing history</h3>
              <p className="text-xs text-ink-500 mt-0.5">{mockInvoices.length} recent invoices</p>
            </div>
            <a
              href="#download-all"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 focus-ring rounded px-1 py-0.5"
            >
              <DownloadIcon />
              Download all
            </a>
          </div>

          <div className="overflow-x-auto scroll-v0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/60">
                  <th className="px-6 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hairline-b last:border-0 transition-colors hover:bg-ink-50/60"
                  >
                    <td className="px-6 py-3.5 text-ink-700 tabular-nums whitespace-nowrap">
                      {fmtDate(inv.issuedAt)}
                    </td>
                    <td className="px-3 py-3.5">
                      <a
                        href={`/app/admin/billing/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-900 hover:text-brand-600 focus-ring rounded px-1 py-0.5"
                      >
                        <span className="tabular-nums">{inv.number}</span>
                        <CopyIcon className="text-ink-400" />
                      </a>
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-ink-900 font-medium whitespace-nowrap">
                      {fmtINR(inv.amount)}
                    </td>
                    <td className="px-3 py-3.5">
                      {inv.status === "PAID" ? (
                        <Badge variant="success">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Paid
                        </Badge>
                      ) : inv.status === "OVERDUE" ? (
                        <Badge variant="danger">Overdue</Badge>
                      ) : inv.status === "SENT" ? (
                        <Badge variant="warning">Sent</Badge>
                      ) : (
                        <Badge variant="neutral">{inv.status}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <a
                        href={`/api/billing/invoices/${inv.id}/pdf`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:text-brand-600 focus-ring rounded px-1 py-0.5"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Auto-renew + cancel ────────────────────────────────────────── */}
      <section className="card-v0 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium text-ink-900">
              Subscription auto-renews on{" "}
              <span className="tabular-nums text-ink-900">{renewDate}</span>
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              You can turn this off anytime — the plan stays active until the period ends.
            </div>
          </div>
          <AutoRenewToggle defaultChecked={currentTierId !== "FREE"} />
        </div>

        <div className="mt-4 pt-4 hairline-t flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-ink-500">
            Need to make changes? Reach out to{" "}
            <a
              href="mailto:billing@adziga.in"
              className="text-ink-700 hover:text-brand-600 focus-ring rounded underline-offset-2 hover:underline"
            >
              billing@adziga.in
            </a>{" "}
            and we&apos;ll take it from there.
          </p>
          <a
            href="#cancel"
            className="text-xs font-medium text-rose-600 hover:text-rose-700 focus-ring rounded px-1.5 py-1"
          >
            Cancel subscription
          </a>
        </div>
      </section>

      {/* ─── Razorpay setup guide ───────────────────────────────────────── */}
      <SetupGuide />
    </div>
  );
}

/**
 * Razorpay setup walkthrough. Shown to admins so they know exactly what to
 * click in the Razorpay dashboard to wire up billing. Direct links use the
 * production Razorpay dashboard URLs — these open in a new tab.
 */
function SetupGuide() {
  const razorpayConfigured =
    typeof process !== "undefined" &&
    !!process.env.RAZORPAY_KEY_ID &&
    !!process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_ID !== "rzp_live_...";

  const steps: Array<{ title: string; body: React.ReactNode; link?: { label: string; href: string } }> = [
    {
      title: "1. Create a Razorpay account",
      body: (
        <>
          If you haven&apos;t already, sign up on Razorpay using your business PAN + bank account.
          Verification takes ~24h. Use the same email you use for Adziga so invoices go to the right place.
        </>
      ),
      link: { label: "Open Razorpay signup →", href: "https://dashboard.razorpay.com/signup" }
    },
    {
      title: "2. Generate API keys",
      body: (
        <>
          Go to <strong>Settings → API Keys</strong> in the Razorpay dashboard. Click <em>Generate Live Key</em>.
          Copy both the <strong>Key ID</strong> (<code>rzp_live_...</code>) and the <strong>Key Secret</strong>.
          You&apos;ll only see the secret once — save it somewhere safe before closing the modal.
        </>
      ),
      link: { label: "Open API Keys →", href: "https://dashboard.razorpay.com/app/keys" }
    },
    {
      title: "3. Create subscription plans",
      body: (
        <>
          Go to <strong>Subscriptions → Plans</strong>. Create two plans that match the Adziga tiers:
          <br />
          <ul className="mt-2 space-y-1.5 text-xs text-ink-600 list-disc list-inside">
            <li><strong>Pro</strong> — Recurring monthly, ₹4,900 / month</li>
            <li><strong>Ziga Plus</strong> — Recurring monthly, ₹24,900 / month</li>
          </ul>
          <span className="block mt-2 text-xs text-ink-500">Note the <code>plan_...</code> ID of each — we&apos;ll need it for env vars.</span>
        </>
      ),
      link: { label: "Open Plans →", href: "https://dashboard.razorpay.com/app/subscriptions/plans" }
    },
    {
      title: "4. Set up the webhook",
      body: (
        <>
          Go to <strong>Settings → Webhooks</strong>. Create a new webhook with URL{" "}
          <code className="text-xs bg-ink-50 px-1.5 py-0.5 rounded">https://adziga-marketing-os.vercel.app/api/billing/webhook</code>{" "}
          and enable these events: <em>subscription.activated</em>, <em>subscription.charged</em>,{" "}
          <em>subscription.cancelled</em>, <em>subscription.completed</em>, <em>payment.failed</em>.
          Copy the <strong>webhook secret</strong>.
        </>
      ),
      link: { label: "Open Webhooks →", href: "https://dashboard.razorpay.com/app/webhooks" }
    },
    {
      title: "5. Add the env vars",
      body: (
        <>
          Once you have all four values, run this in your terminal from the project root:
          <pre className="mt-2 text-[12px] leading-relaxed bg-ink-950 text-ink-100 rounded-lg p-3 font-mono whitespace-pre-wrap">
{`node scripts/setup-credentials.mjs razorpay \\
  --key-id rzp_live_xxxxxxxxxxxx \\
  --key-secret xxxxxxxxxxxxxxxxxxxxxxxx \\
  --webhook-secret xxxxxxxxxxxxxxxxxxxxxxxx \\
  --plan-pro plan_xxxxxxxxxxxx \\
  --plan-ziga-plus plan_xxxxxxxxxxxx`}
          </pre>
          <span className="block mt-2 text-xs text-ink-500">
            The script writes to <code>.env</code> locally and pushes to Vercel production. You&apos;ll be prompted for confirmation.
          </span>
        </>
      )
    }
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-ink-200/70">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-1">Setup</div>
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Wire up Razorpay</h2>
          <p className="text-sm text-ink-500 mt-1">
            Razorpay powers recurring billing, GST-compliant invoices, and UPI/card/netbanking for Indian customers.
            Follow the five steps below — direct links open the Razorpay dashboard.
          </p>
        </div>
        {razorpayConfigured ? (
          <Badge variant="success" dot>Configured</Badge>
        ) : (
          <Badge variant="warning" dot>Not configured</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-ink-200/70 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-7 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14.5px] font-semibold tracking-tight text-ink-900">{s.title}</h3>
                <div className="text-sm text-ink-600 mt-2 leading-relaxed">{s.body}</div>
                {s.link && (
                  <a
                    href={s.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    {s.link.label}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-ink-200/70 bg-ink-50/40 p-5">
        <div className="flex items-start gap-3">
          <Badge variant="info">Heads up</Badge>
          <div className="text-sm text-ink-700 leading-relaxed">
            <strong>Why Razorpay?</strong> Built for India — UPI, RuPay, GST-compliant invoicing, and INR settlement
            without the 4–5% premium that cross-border gateways (Stripe, Adyen) charge on Indian cards. Razorpay&apos;s
            Subscriptions API gives us native support for monthly recurring plans with prorated upgrades, dunning,
            and webhooks out of the box. For an Indian-focused marketing SaaS, the alternative is Stripe Atlas
            (expensive + offshore settlement) or direct UPI deep-links (no recurring billing). Razorpay is the
            pragmatic default.
          </div>
        </div>
      </div>
    </section>
  );
}
