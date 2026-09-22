// Adziga — /app/admin/integrations
// Connection status for every external provider, plus step-by-step setup
// guides with direct links to the dev consoles. Self-serve where possible.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Button, Card, SectionHeader } from "@/app/app/_components/ui";
import { fmtRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

type Provider = {
  id: string;
  name: string;
  description: string;
  category: "ai" | "ads" | "messaging" | "data" | "billing";
  status: "configured" | "available" | "stub";
  docsUrl?: string;
  guide?: React.ReactNode;
};

export default async function IntegrationsPage() {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const integrations = await prisma.integration.findMany({ where: { orgId: session.orgId } });
  const find = (provider: string) => integrations.find((i) => i.provider === provider);

  const aiKey = !!process.env.GEMINI_API_KEY;
  const minimaxKey = !!process.env.MINIMAX_API_KEY;
  const metaKey = !!process.env.META_ACCESS_TOKEN;
  const googleKey = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const whatsappKey = !!process.env.WHATSAPP_API_TOKEN;
  const razorpayKey = !!process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== "rzp_live_...";

  const providers: Provider[] = [
    {
      id: "GEMINI",
      name: "Google Gemini",
      description: "Powers the AI assistant, Strategy Agent, and Content Agent.",
      category: "ai",
      status: aiKey ? "configured" : "stub",
      docsUrl: "https://aistudio.google.com/apikey"
    },
    {
      id: "MINIMAX",
      name: "MiniMax",
      description: "Fallback LLM chain — activates when every Gemini model returns empty/429/503.",
      category: "ai",
      status: minimaxKey ? "configured" : "stub",
      docsUrl: "https://agent.minimax.io"
    },
    {
      id: "META",
      name: "Meta (Facebook + Instagram)",
      description: "Read campaign + ad set + creative performance. Write new campaigns and audiences.",
      category: "ads",
      status: metaKey ? "configured" : "available",
      guide: <MetaGuide />
    },
    {
      id: "GOOGLE",
      name: "Google Ads + Analytics",
      description: "Search, Display, YouTube campaigns. Conversion + audience sync.",
      category: "ads",
      status: googleKey ? "configured" : "available",
      guide: <GoogleGuide />
    },
    {
      id: "WHATSAPP",
      name: "WhatsApp Business",
      description: "Send broadcasts, run keyword automations, qualify inbound leads.",
      category: "messaging",
      status: whatsappKey ? "configured" : "available",
      guide: <WhatsappGuide />
    },
    {
      id: "RAZORPAY",
      name: "Razorpay",
      description: "Recurring subscription billing + GST-compliant invoices.",
      category: "billing",
      status: razorpayKey ? "configured" : "available",
      guide: (
        <Link href="/app/admin/billing#wire-up-razorpay" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium mt-2">
          Razorpay setup is on the Billing page →
        </Link>
      )
    },
    {
      id: "TIKTOK",
      name: "TikTok Ads",
      description: "Short-form video campaigns for tier-1 city audiences. Roadmap — not yet wired.",
      category: "ads",
      status: "available"
    },
    {
      id: "LINKEDIN",
      name: "LinkedIn Marketing",
      description: "B2B targeting for enterprise clients. Roadmap.",
      category: "ads",
      status: "available"
    },
    {
      id: "BIGQUERY",
      name: "BigQuery",
      description: "Analytical warehouse for clients with >1M events/mo. Available on Ziga+ tier.",
      category: "data",
      status: "available"
    }
  ];

  const byCategory: Record<string, Provider[]> = { ai: [], ads: [], messaging: [], data: [], billing: [] };
  for (const p of providers) byCategory[p.category].push(p);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Integrations"
        subtitle="Connect Adziga to the platforms your campaigns run on. Every provider has its own health, sync, and audit trail."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Integrations" }]}
      />

      {/* Status overview strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <Card padding="md">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Connected</div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5 tracking-tight">
            {providers.filter((p) => p.status === "configured").length}<span className="text-ink-400 text-base">/{providers.length}</span>
          </div>
        </Card>
        <Card padding="md">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">In setup</div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5 tracking-tight">
            {providers.filter((p) => p.status === "available").length}
          </div>
        </Card>
        <Card padding="md">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Stub mode</div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5 tracking-tight">
            {providers.filter((p) => p.status === "stub").length}
          </div>
        </Card>
        <Card padding="md">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Last sync</div>
          <div className="text-sm font-medium mt-2">
            {(() => {
              const last = integrations
                .filter((i) => i.lastSyncAt)
                .sort((a, b) => +new Date(b.lastSyncAt!) - +new Date(a.lastSyncAt!))[0];
              return last ? fmtRelative(last.lastSyncAt!) : "—";
            })()}
          </div>
        </Card>
        <Card padding="md">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">Healthy</div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5 tracking-tight">
            {integrations.filter((i) => i.status === "HEALTHY").length}
            <span className="text-ink-400 text-base">/{integrations.length}</span>
          </div>
        </Card>
      </div>

      {(["ai", "ads", "messaging", "billing", "data"] as const).map((cat) => {
        const list = byCategory[cat];
        if (list.length === 0) return null;
        const label = { ai: "AI providers", ads: "Ad platforms", messaging: "Messaging", billing: "Billing", data: "Data" }[cat];
        return (
          <div key={cat} className="mb-8">
            <SectionHeader title={label} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {list.map((p) => (
                <ProviderCard key={p.id} provider={p} integration={find(p.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProviderCard({ provider, integration }: { provider: Provider; integration: any }) {
  const statusVariant =
    provider.status === "configured" ? "success" : provider.status === "stub" ? "warning" : "neutral";
  const statusLabel =
    provider.status === "configured" ? "Connected" : provider.status === "stub" ? "Stub" : "Not configured";

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{provider.name}</h3>
            <Badge variant={statusVariant} dot>{statusLabel}</Badge>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">{provider.description}</p>
        </div>
      </div>

      {integration && (
        <div className="mt-3 pt-3 border-t border-ink-100">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-ink-500">Last sync</div>
              <div className="text-ink-900 font-medium">{integration.lastSyncAt ? fmtRelative(integration.lastSyncAt) : "never"}</div>
            </div>
            <div>
              <div className="text-ink-500">Status</div>
              <div>
                <Badge variant={integration.status === "HEALTHY" ? "success" : integration.status === "DOWN" ? "danger" : "warning"} dot>
                  {integration.status}
                </Badge>
              </div>
            </div>
            {integration.errorMessage && (
              <div className="col-span-2">
                <div className="text-ink-500">Last error</div>
                <div className="text-rose-700 font-mono text-[11.5px] mt-0.5">{integration.errorMessage}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {provider.docsUrl && (
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium mt-3"
        >
          Open dev console →
        </a>
      )}

      {provider.guide && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-ink-900 flex items-center gap-2 select-none">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-ink-100 text-ink-700 text-[10px] font-bold transition-transform group-open:rotate-90">›</span>
            Setup guide
          </summary>
          <div className="mt-3 pl-6">{provider.guide}</div>
        </details>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Provider setup guides — each one links to the exact dev console page the
// admin needs to open. Hand-rolled so we don't depend on screenshots.
// ─────────────────────────────────────────────────────────────────────────

function MetaGuide() {
  return (
    <ol className="space-y-3 text-sm text-ink-700">
      <li>
        <strong>1. Create a Meta App.</strong>{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-brand-600 hover:underline">developers.facebook.com/apps → Create App</a>{" "}
        — choose <em>Business</em> as the type.
      </li>
      <li>
        <strong>2. Add Marketing API.</strong> In the app dashboard, click <em>Add Product</em> → <em>Marketing API</em>.
        Generate a permanent access token via{" "}
        <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener" className="text-brand-600 hover:underline">System Users</a>{" "}
        with <code>ads_read</code>, <code>ads_management</code>, <code>business_management</code>.
      </li>
      <li>
        <strong>3. Get the App ID + Secret.</strong>{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-brand-600 hover:underline">Settings → Basic</a>{" "}
        shows both. Save the app secret — Facebook only shows it once.
      </li>
      <li>
        <strong>4. Run setup.</strong> From your terminal, with these four values ready:
        <pre className="mt-2 text-[12px] leading-relaxed bg-ink-950 text-ink-100 rounded-lg p-3 font-mono whitespace-pre-wrap">
{`node scripts/setup-credentials.mjs meta \\
  --access-token EAAxxxxxx... \\
  --app-secret xxxxxxxxxxxxxxxx`}
        </pre>
      </li>
    </ol>
  );
}

function GoogleGuide() {
  return (
    <ol className="space-y-3 text-sm text-ink-700">
      <li>
        <strong>1. Create a Google Ads Manager account.</strong>{" "}
        <a href="https://ads.google.com/home/tools/manager-accounts/" target="_blank" rel="noopener" className="text-brand-600 hover:underline">ads.google.com → Tools → Manager Accounts</a>{" "}
        (or use an existing MCC).
      </li>
      <li>
        <strong>2. Apply for API access.</strong>{" "}
        <a href="https://developers.google.com/google-ads/api/docs/access-levels" target="_blank" rel="noopener" className="text-brand-600 hover:underline">Google Ads API Center</a>{" "}
        — fill the form with your MCC ID and a 30-line description of how Adziga uses the API.
        Approval typically takes 24–48h.
      </li>
      <li>
        <strong>3. Create OAuth credentials.</strong>{" "}
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-brand-600 hover:underline">console.cloud.google.com → APIs & Services → Credentials</a>{" "}
        → <em>Create OAuth 2.0 Client ID</em>. Add{" "}
        <code className="text-xs bg-ink-50 px-1.5 py-0.5 rounded">https://adziga-marketing-os.vercel.app/api/integrations/google/callback</code>{" "}
        as a redirect URI.
      </li>
      <li>
        <strong>4. Run setup.</strong>
        <pre className="mt-2 text-[12px] leading-relaxed bg-ink-950 text-ink-100 rounded-lg p-3 font-mono whitespace-pre-wrap">
{`node scripts/setup-credentials.mjs google-ads \\
  --developer-token xxxxxxxxxxxxxxxx \\
  --client-id xxxxxxxxxxxxxxxx.apps.googleusercontent.com \\
  --client-secret GOCSPX-xxxxxxxxxxxx \\
  --refresh-token xxxxxxxxxxxxxxxx`}
        </pre>
      </li>
    </ol>
  );
}

function WhatsappGuide() {
  return (
    <ol className="space-y-3 text-sm text-ink-700">
      <li>
        <strong>1. Set up a Meta WhatsApp Business app.</strong>{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-brand-600 hover:underline">developers.facebook.com/apps → Create App</a>{" "}
        — choose <em>Business</em> type, then add the <em>WhatsApp</em> product.
      </li>
      <li>
        <strong>2. Verify your business.</strong>{" "}
        <a href="https://business.facebook.com/settings" target="_blank" rel="noopener" className="text-brand-600 hover:underline">Business Settings → Security Centre</a>{" "}
        — submit your business registration + a display name. Approval: 1–3 business days.
      </li>
      <li>
        <strong>3. Get the API token + phone number ID.</strong>{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-brand-600 hover:underline">WhatsApp → API Setup</a>{" "}
        shows the test phone number + permanent token. Copy both.
      </li>
      <li>
        <strong>4. Set the webhook.</strong> In the WhatsApp product page, point the webhook at{" "}
        <code className="text-xs bg-ink-50 px-1.5 py-0.5 rounded">https://adziga-marketing-os.vercel.app/api/integrations/whatsapp/webhook</code>{" "}
        and subscribe to <code>messages</code>.
      </li>
      <li>
        <strong>5. Run setup.</strong>
        <pre className="mt-2 text-[12px] leading-relaxed bg-ink-950 text-ink-100 rounded-lg p-3 font-mono whitespace-pre-wrap">
{`node scripts/setup-credentials.mjs whatsapp \\
  --api-token EAAxxxxxx... \\
  --phone-number-id 1234567890`}
        </pre>
      </li>
    </ol>
  );
}
