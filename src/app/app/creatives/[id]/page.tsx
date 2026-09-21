// /app/creatives/[id] — creative detail with status workflow
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CreativeActions } from "./_actions";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<string, string> = {
  DRAFT: "bg-ink-100 text-ink-700 ring-ink-200",
  IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACTIVE: "bg-brand-50 text-brand-700 ring-brand-200",
  PAUSED: "bg-orange-50 text-orange-700 ring-orange-200",
  ARCHIVED: "bg-ink-50 text-ink-500 ring-ink-200"
};

const ALLOWED: Record<string, string[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE", "DRAFT"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT"]
};

export default async function CreativeDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  const creative = await prisma.creative.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      campaign: { include: { client: true } }
    }
  });
  if (!creative) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <Link href="/app/creatives" className="hover:text-ink-900">Creatives</Link>
            <span>›</span>
            <span>v{creative.version}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{creative.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ring-1 ${STATUS_TINT[creative.status]}`}>
              {creative.status.replace("_", " ")}
            </span>
            <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 text-xs font-medium">{creative.platform}</span>
            <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 text-xs font-medium">{creative.format}</span>
            <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 text-xs font-medium">{creative.source.replace("_", " ")}</span>
            {creative.campaign && (
              <Link href={`/app/campaigns/${creative.campaign.id}`} className="text-xs text-brand-600 hover:underline">
                {creative.campaign.client.businessName} · {creative.campaign.name}
              </Link>
            )}
          </div>
        </div>
        <CreativeActions creativeId={creative.id} currentStatus={creative.status} allowed={ALLOWED[creative.status] ?? []} />
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Media preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-v0 p-4">
            <div className="aspect-square lg:aspect-video bg-gradient-to-br from-ink-50 to-ink-100 rounded-lg overflow-hidden flex items-center justify-center">
              {creative.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creative.mediaUrl} alt={creative.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-ink-400 text-sm">No media yet — upload or generate an image.</div>
              )}
            </div>
          </div>

          <div className="card-v0 p-5 space-y-3">
            <h2 className="font-semibold text-sm">Copy</h2>
            {creative.hook && (
              <div>
                <div className="text-xs font-medium text-ink-500 mb-0.5">Hook</div>
                <p className="text-sm font-semibold text-brand-700">"{creative.hook}"</p>
              </div>
            )}
            {creative.headline && (
              <div>
                <div className="text-xs font-medium text-ink-500 mb-0.5">Headline</div>
                <h3 className="text-lg font-bold text-ink-900">{creative.headline}</h3>
              </div>
            )}
            {creative.primaryCopy && (
              <div>
                <div className="text-xs font-medium text-ink-500 mb-0.5">Body</div>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{creative.primaryCopy}</p>
              </div>
            )}
            {creative.cta && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500">CTA:</span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-brand-500 text-white text-sm font-semibold">{creative.cta}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <div className="card-v0 p-5 space-y-3">
            <h2 className="font-semibold text-sm">Details</h2>
            <Meta label="Source" value={creative.source.replace("_", " ")} />
            {creative.creator && <Meta label="Creator" value={creative.creator} />}
            {creative.audience && <Meta label="Audience" value={creative.audience} />}
            <Meta label="Version" value={`v${creative.version}`} />
            <Meta label="Created" value={creative.createdAt.toLocaleString()} />
            <Meta label="Updated" value={creative.updatedAt.toLocaleString()} />
          </div>

          {/* Workflow hint */}
          <div className="card-v0 p-5 bg-gradient-to-br from-brand-50 to-accent-50">
            <h2 className="font-semibold text-sm mb-2">Workflow</h2>
            <ol className="text-xs space-y-1.5 text-ink-700">
              <li className={creative.status === "DRAFT" ? "font-bold text-brand-700" : ""}>1. DRAFT — write it, generate it, or upload it</li>
              <li className={creative.status === "IN_REVIEW" ? "font-bold text-brand-700" : ""}>2. IN_REVIEW — your team's eyes on it</li>
              <li className={creative.status === "APPROVED" ? "font-bold text-brand-700" : ""}>3. APPROVED — ready to go live</li>
              <li className={creative.status === "ACTIVE" ? "font-bold text-brand-700" : ""}>4. ACTIVE — running on a campaign</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 text-right font-medium truncate">{value}</span>
    </div>
  );
}
