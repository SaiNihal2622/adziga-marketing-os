// Adziga — /app/admin/ingestion-token
// Sprint 19c — rotate / revoke the org's ad-spend ingestion token.
// Token format: `adz_ing_<orgId-short>_<random>`. POST to /api/ingest/ad-spend
// with `Authorization: Bearer <token>`.

import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { AdSpendIngestionService } from "@/server/services/ad-spend-ingestion";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { fmtRelative } from "@/lib/format";
import { IngestionTokenActions } from "./_actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IngestionTokenPage() {
  const sessionInfo = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const info = await AdSpendIngestionService.getIngestionTokenInfo(sessionInfo.orgId);

  const tokenAgeDays = info.createdAt
    ? Math.floor((Date.now() - new Date(info.createdAt).getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingestion token"
        subtitle="Bearer token for `POST /api/ingest/ad-spend`. Pre-OAuth bridge until Meta/Google oauth flows are wired. Rotate if you've shared the token widely; revoke to invalidate the current one immediately."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Ingestion token" }]}
        right={
          <Link href="/app/admin/integrations" className="px-2 py-1 rounded text-xs bg-ink-100 text-ink-700 hover:bg-ink-200">
            ← Integrations
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Token status"
          value={info.hasToken ? "Active" : "None"}
          hint={info.hasToken ? "token exists in metadata" : "no token issued"}
          tone={info.hasToken ? "success" : "neutral"}
        />
        <Kpi
          label="Created"
          value={info.createdAt ? fmtRelative(new Date(info.createdAt)) : "—"}
          hint={info.createdAt?.slice(0, 10)}
        />
        <Kpi
          label="Token age"
          value={tokenAgeDays !== null ? `${tokenAgeDays}d` : "—"}
          hint={tokenAgeDays === null ? "no token" : tokenAgeDays > 90 ? "consider rotating" : "fresh"}
          tone={tokenAgeDays !== null && tokenAgeDays > 90 ? "accent" : "neutral"}
        />
        <Kpi
          label="Previous"
          value={info.previousRevokedAt ? "revoked" : "—"}
          hint={info.previousRevokedAt?.slice(0, 10)}
        />
      </div>

      <SectionHeader title="Token actions" description="Mint a new token (existing token is invalidated) or revoke the current token." />
      <Card padding="lg">
        <IngestionTokenActions hasToken={info.hasToken} />
      </Card>

      <SectionHeader title="How to use" description="Manual ingestion reference for spreadsheet uploads / n8n / Zapier / Meta offline-sync." />
      <Card padding="lg">
        <pre className="text-xs bg-ink-50 rounded-lg p-4 overflow-x-auto font-mono whitespace-pre">
{`curl -X POST https://adziga-marketing-os.vercel.app/api/ingest/ad-spend \\
  -H "Authorization: Bearer adz_ing_<short-org>_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rows": [
      {
        "campaignId": "campaign_cuid_here",
        "date": "2026-09-23",
        "amount": 1250.50,
        "source": "meta"
      }
    ]
  }'`}
        </pre>
        <p className="text-xs text-ink-500 mt-3">
          • <code className="text-xs">Authorization: Bearer &lt;token&gt;</code> header authenticates the call.<br/>
          • <code className="text-xs">campaignId</code> must be an existing campaign in the org; use{" "}
          <Link href="/app/campaigns" className="text-brand-600 hover:underline">/app/campaigns</Link> to grab one.<br/>
          • Date is ISO yyyy-mm-dd; amount in INR; source is free-text but commonly <code className="text-xs">meta</code>, <code className="text-xs">google</code>, <code className="text-xs">youtube</code>, etc.<br/>
          • Each row upserts a daily AdSpend row + recomputes Campaign.spent. Idempotent on (orgId, campaignId, date).
        </p>
      </Card>
    </div>
  );
}
