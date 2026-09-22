// Adziga — /app/docs/api
// Sprint 14d — internal API documentation index. Lists every public
// route, what it does, what auth it needs, and a sample request body.
// Server-rendered so we don't need a separate docs site.

import { PageHeader } from "../../_components/page-header";
import { Card, Badge, Kpi, SectionHeader } from "../../_components/ui";
import Link from "next/link";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

type Route = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  purpose: string;
  auth: "session" | "bearer-token" | "none" | "meta-signature" | "razorpay-signature";
  body?: string;
  notes?: string;
};

const ROUTES: Route[] = [
  // Webhooks (no auth — signature-verified)
  { method: "POST", path: "/api/webhooks/meta", purpose: "Meta Lead Ads webhook receiver", auth: "meta-signature" },
  { method: "POST", path: "/api/webhooks/razorpay", purpose: "Razorpay billing webhook receiver", auth: "razorpay-signature" },

  // Ingestion
  { method: "POST", path: "/api/ingest/ad-spend", purpose: "Bulk daily ad-spend rows (Meta/Google/manual)", auth: "bearer-token", body: '{ rows: [{ date, amount, platform, campaignId? | campaignExternalId? }] }' },

  // Analytics
  { method: "GET", path: "/api/analytics/anomalies/campaigns?days=30&recommendation=pause|watch|scale", purpose: "Per-campaign anomaly report with auto-pause recommendation", auth: "session" },
  { method: "GET", path: "/api/analytics/conversion-lag?days=90&clientId=...", purpose: "Lead → customer lag percentiles by channel", auth: "session" },
  { method: "POST", path: "/api/analytics/predict", purpose: "Predict outcomes for a proposed marketing plan", auth: "session", body: '{ plan: { channels: [{ platform, totalBudget }] }, clientId?, industry? }' },
  { method: "GET", path: "/api/analytics/roi/org?days=60", purpose: "Org-wide ROI dashboard", auth: "session" },
  { method: "GET", path: "/api/analytics/roi/client?clientId=...&days=60", purpose: "Per-client ROI report", auth: "session" },
  { method: "GET", path: "/api/analytics/roi/export?clientId=...&days=60", purpose: "CSV export of per-channel ROI", auth: "session" },
  { method: "GET", path: "/api/analytics/cohorts/client?clientId=...&months=6", purpose: "Lead → customer cohort retention matrix", auth: "session" },
  { method: "GET", path: "/api/analytics/cohorts/export?clientId=...&months=6", purpose: "CSV export of cohort retention", auth: "session" },
  { method: "GET", path: "/api/analytics/ltv?clientId=...&days=365", purpose: "True LTV from Revenue event log", auth: "session" },
  { method: "POST", path: "/api/analytics/ltv/record", purpose: "Record a new Revenue event for repeat purchase / upsell", auth: "session", body: "{ customerId, amount, kind?, externalRef? }" },

  // Experiments
  { method: "GET", path: "/api/experiments", purpose: "List experiments", auth: "session" },
  { method: "POST", path: "/api/experiments", purpose: "Create experiment with variant seed", auth: "session" },
  { method: "GET", path: "/api/experiments/[id]", purpose: "Experiment detail + Bayesian analysis", auth: "session" },
  { method: "POST", path: "/api/experiments/[id]", purpose: "Transition (start | complete | cancel)", auth: "session" },
  { method: "POST", path: "/api/experiments/[id]/promote", purpose: "Promote winner config to a StrategyRecommendation", auth: "session" },
  { method: "GET", path: "/api/experiments/[id]/results", purpose: "Bayesian analysis only (for live-tail)", auth: "session" },

  // Admin
  { method: "GET", path: "/api/admin/policies", purpose: "List AutoApprove policies (returns `library` template array too)", auth: "session" },
  { method: "POST", path: "/api/admin/policies", purpose: "Upsert a single policy by id", auth: "session" },
  { method: "DELETE", path: "/api/admin/policies?policyId=...", purpose: "Delete a policy", auth: "session" },
  { method: "GET", path: "/api/admin/policies/preview", purpose: "Dry-run evaluator for a proposed change", auth: "session" },
  { method: "GET", path: "/api/admin/auto-apply-log?limit=50", purpose: "Recent auto-applied changes (audit feed)", auth: "session" },
  { method: "POST", path: "/api/admin/policy-library/instantiate", purpose: "Mint a prebuilt policy template into this org", auth: "session" },
  { method: "GET", path: "/api/admin/anomaly-overrides", purpose: "Read org-specific anomaly thresholds", auth: "session" },
  { method: "POST", path: "/api/admin/anomaly-overrides", purpose: "Update sigma threshold + industry-ceiling multiplier", auth: "session" },
  { method: "POST", path: "/api/admin/ingestion-token", purpose: "Mint a new bearer token for /api/ingest/ad-spend", auth: "session" },
  { method: "GET", path: "/api/admin/benchmarks", purpose: "List industry benchmarks (optional ?industry= filter)", auth: "session" },
  { method: "POST", path: "/api/admin/benchmarks", purpose: "Upsert industry benchmark (industry, objective, channel, region)", auth: "session" },
  { method: "POST", path: "/api/admin/webhooks/[id]/retry", purpose: "Re-run a failed webhook delivery", auth: "session" },

  // Campaigns
  { method: "POST", path: "/api/campaigns", purpose: "Create campaign", auth: "session" },
  { method: "POST", path: "/api/campaigns/import", purpose: "Bulk CSV campaign import (text/csv body)", auth: "session" },

  // Plans
  { method: "POST", path: "/api/plans", purpose: "Create + execute a multi-step plan (ROI → predict → anomalies → allocate → create)", auth: "session" },
  { method: "GET", path: "/api/plans", purpose: "List recent plans", auth: "session" },

  // Activity
  { method: "GET", path: "/api/activity/recent?limit=20", purpose: "Recent audit log events (one-shot)", auth: "session" },
  { method: "GET", path: "/api/activity/stream", purpose: "SSE stream of audit log events", auth: "session" }
];

export default function ApiDocsPage() {
  const byMethod = ROUTES.reduce<Record<string, Route[]>>((acc, r) => {
    (acc[r.method] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="API documentation"
        subtitle="Every public route exposed by Adziga. Internal — admins only."
        eyebrow="Reference"
        breadcrumbs={[{ label: "App", href: "/app/overview" }, { label: "Docs" }, { label: "API" }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total routes" value={ROUTES.length} />
        <Kpi label="GETs" value={(byMethod.GET ?? []).length} />
        <Kpi label="POSTs" value={(byMethod.POST ?? []).length} />
        <Kpi label="Bash-able" value={fmtNum((byMethod.GET ?? []).length + (byMethod.POST ?? []).length)} hint="GET + POST endpoints" />
      </div>

      <SectionHeader title="Auth modes" description="How each route authenticates" />
      <Card>
        <ul className="text-xs text-ink-600 space-y-1">
          <li><strong>session</strong> — cookie-based auth via NextAuth. Required for everything except webhooks and ingestion.</li>
          <li><strong>bearer-token</strong> — <code className="bg-ink-50 px-1 rounded">adz_ing_&lt;orgId8&gt;_&lt;32hex&gt;</code> format. Mint via <code className="bg-ink-50 px-1 rounded">POST /api/admin/ingestion-token</code>.</li>
          <li><strong>meta-signature</strong> — verified via <code className="bg-ink-50 px-1 rounded">x-hub-signature-256</code> header (HMAC-SHA256 with <code className="bg-ink-50 px-1 rounded">META_APP_SECRET</code>).</li>
          <li><strong>razorpay-signature</strong> — verified via <code className="bg-ink-50 px-1 rounded">x-razorpay-signature</code> header.</li>
        </ul>
      </Card>

      <SectionHeader title="Routes" />
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Method</th>
                <th className="text-left px-4 py-2">Path</th>
                <th className="text-left px-4 py-2">Purpose</th>
                <th className="text-left px-4 py-2">Auth</th>
                <th className="text-left px-4 py-2">Body</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((r) => (
                <tr key={r.method + r.path} className="border-b border-ink-100">
                  <td className="px-4 py-2 text-xs">
                    <Badge variant={methodVariant(r.method)}>{r.method}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">{r.path}</td>
                  <td className="px-4 py-2 text-xs">{r.purpose}</td>
                  <td className="px-4 py-2 text-xs">
                    <Badge variant="neutral">{r.auth}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-ink-500 max-w-md truncate" title={r.body ?? ""}>
                    {r.body ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function methodVariant(m: string): "neutral" | "brand" | "success" | "accent" {
  if (m === "GET") return "neutral";
  if (m === "POST") return "brand";
  if (m === "DELETE") return "accent";
  return "success";
}
