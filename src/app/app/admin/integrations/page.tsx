import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const integrations = await prisma.integration.findMany({
    where: { orgId: session.orgId },
    orderBy: { provider: "asc" }
  });

  const providers = [
    { name: "META",      desc: "Meta Ads - campaign, ad set, ad, creative performance." },
    { name: "GOOGLE",    desc: "Google Ads + Analytics - search, display, GA4." },
    { name: "WHATSAPP",  desc: "WhatsApp Business API - messaging + lead workflows." },
    { name: "GEMINI",    desc: "Google Gemini - current AI assistant provider." },
    { name: "TIKTOK",    desc: "TikTok Ads - short-form video campaigns." },
    { name: "LINKEDIN",  desc: "LinkedIn Marketing - B2B targeting." },
    { name: "VERTEX_AI", desc: "Vertex AI - future strategy intelligence training." },
    { name: "BIGQUERY",  desc: "BigQuery - analytical warehouse at scale." },
    { name: "FIREBASE",  desc: "Firebase - auth, push, real-time." }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Architecture is integration-first. Each provider has its own health, sync, and audit trail."
      />

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
                <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
                  Last sync: {inst.lastSyncAt ? relTime(inst.lastSyncAt) : "-"}
                  {inst.errorMessage && <div className="text-amber-600 mt-1">{inst.errorMessage}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}