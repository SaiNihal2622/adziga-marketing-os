import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { relTime } from "@/lib/format";
import { ConnectorControls } from "./controls";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const session = await requireSession();
  const integrations = await prisma.integration.findMany({
    where: { orgId: session.orgId },
    orderBy: { provider: "asc" }
  });

  const providers = [
    { name: "META", desc: "Meta Ads - campaigns, ad sets, ads, creative performance + leads via Meta CAPI." },
    { name: "GOOGLE", desc: "Google Ads + Analytics - search, display, conversions, GA4." },
    { name: "WHATSAPP", desc: "WhatsApp Business API - automated messaging, lead workflows, templates." },
    { name: "GEMINI", desc: "Google Gemini - AI assistant provider (strategy, content, automation)." },
    { name: "TIKTOK", desc: "TikTok Ads - short-form video campaigns." },
    { name: "LINKEDIN", desc: "LinkedIn Marketing - B2B targeting." },
    { name: "FIREBASE", desc: "Firebase - auth, push notifications, real-time." },
    { name: "VERTEX_AI", desc: "Vertex AI - future strategy intelligence training." },
    { name: "BIGQUERY", desc: "BigQuery - analytical data warehouse (Phase 2+)." }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        subtitle="Phase 1 - integration-first architecture. Every provider has its own health, sync, and audit trail."
        right={<span className="badge badge-brand">Phase 1</span>}
      />

      <ConnectorControls />

      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((p) => {
          const inst = integrations.find((i) => i.provider === p.name);
          return (
            <div key={p.name} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-ink-500 mt-1">{p.desc}</div>
                </div>
                {inst ? <StatusPill status={inst.status} /> : <span className="badge badge-neutral">Not configured</span>}
              </div>
              {inst && (
                <div className="mt-3 pt-3 border-t border-ink-100 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">Last sync</span>
                    <span>{inst.lastSyncAt ? relTime(inst.lastSyncAt) : "-"}</span>
                  </div>
                  {inst.errorMessage && (
                    <div className="text-amber-600 mt-1 text-[11px]">{inst.errorMessage}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">How integration health works</h3>
        <ul className="text-sm text-ink-700 space-y-2">
          <li>1. Each provider has its own sync window. Failed syncs degrade the integration status (HEALTHY to DEGRADED to FAILED).</li>
          <li>2. <strong>Background scheduler</strong> rotates status hourly via the <code className="bg-ink-100 px-1 rounded">integration.health_check</code> job.</li>
          <li>3. Manual "Run all" lets you force a sync across every connector in one click.</li>
          <li>4. All health changes are logged to AuditLog.</li>
        </ul>
      </div>
    </div>
  );
}