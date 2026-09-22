// /app/studio/briefs/[id] — brief detail with workflow actions
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BriefActions } from "./_actions";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<string, string> = {
  OPEN: "bg-brand-50 text-brand-700 ring-brand-200",
  CLAIMED: "bg-amber-50 text-amber-700 ring-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-ink-50 text-ink-500 ring-ink-200"
};

const ALLOWED: Record<string, string[]> = {
  OPEN: ["CLAIMED", "ARCHIVED"],
  CLAIMED: ["IN_PROGRESS", "OPEN", "ARCHIVED"],
  IN_PROGRESS: ["IN_REVIEW", "OPEN"],
  IN_REVIEW: ["DELIVERED", "IN_PROGRESS"],
  DELIVERED: ["ARCHIVED"],
  ARCHIVED: []
};

const PRIORITY_TINT: Record<string, string> = {
  LOW: "bg-ink-100 text-ink-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700"
};

export default async function BriefDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  const brief = await prisma.brief.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      client: true,
      campaign: true,
      assignee: { select: { id: true, name: true, email: true, image: true } },
      creator: { select: { id: true, name: true, email: true, image: true } }
    }
  });
  if (!brief) notFound();

  const isClaimable = brief.status === "OPEN" && !brief.assigneeId;
  const isMyBrief = brief.assigneeId === session.userId;
  const canDeliver = isMyBrief && ["CLAIMED", "IN_PROGRESS", "IN_REVIEW"].includes(brief.status);
  const canTransition = !["OPEN", "ARCHIVED"].includes(brief.status) ||
    ["FOUNDER", "ADMIN", "SUPER_ADMIN", "MARKETING_MANAGER", "CONTENT"].includes(session.role);

  const due = brief.dueDate ? new Date(brief.dueDate) : null;
  const overdue = due && due < new Date() && brief.status !== "DELIVERED";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
            <Link href="/app/studio" className="hover:text-ink-900">Studio</Link>
            <span>›</span>
            <span>{brief.format}</span>
            <span>·</span>
            <span>{brief.platform}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{brief.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ring-1 ${STATUS_TINT[brief.status]}`}>
              {brief.status.replace("_", " ")}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${PRIORITY_TINT[brief.priority]}`}>
              {brief.priority}
            </span>
            {brief.client && (
              <Link href={`/app/clients/${brief.client.id}`} className="text-xs text-brand-600 hover:underline">
                📦 {brief.client.businessName}
              </Link>
            )}
            {brief.campaign && (
              <Link href={`/app/campaigns/${brief.campaign.id}`} className="text-xs text-brand-600 hover:underline">
                🎯 {brief.campaign.name}
              </Link>
            )}
            {due && (
              <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-ink-600"}`}>
                {overdue ? "⚠ Overdue: " : "Due: "}
                {due.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <BriefActions
          briefId={brief.id}
          currentStatus={brief.status}
          allowedTransitions={ALLOWED[brief.status] ?? []}
          isClaimable={isClaimable}
          canDeliver={canDeliver}
          canTransition={canTransition}
          isMyBrief={isMyBrief}
          deliveredAssetUrl={brief.deliveredAssetUrl}
        />
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Brief */}
          <div className="card-v0 p-5">
            <h2 className="font-semibold text-sm mb-2">Brief</h2>
            <div className="prose prose-sm max-w-none text-ink-700 whitespace-pre-wrap">{brief.brief}</div>
          </div>

          {/* Copy direction */}
          {brief.copyDirection && (
            <div className="card-v0 p-5">
              <h2 className="font-semibold text-sm mb-2">Copy direction</h2>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{brief.copyDirection}</p>
            </div>
          )}

          {/* References */}
          {brief.referenceUrls.length > 0 && (
            <div className="card-v0 p-5">
              <h2 className="font-semibold text-sm mb-2">References</h2>
              <ul className="space-y-1.5">
                {brief.referenceUrls.map((url: string, i: number) => (
                  <li key={i} className="text-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-mono text-xs break-all">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Delivery */}
          {brief.deliveredAssetUrl && (
            <div className="card-v0 p-5">
              <h2 className="font-semibold text-sm mb-2">Delivered asset</h2>
              {/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(brief.deliveredAssetUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brief.deliveredAssetUrl} alt="Delivered asset" className="rounded-lg max-h-96 w-auto" />
              ) : (
                <a href={brief.deliveredAssetUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-mono text-xs break-all">
                  {brief.deliveredAssetUrl}
                </a>
              )}
              {brief.deliveredNote && (
                <p className="mt-3 text-sm text-ink-700 whitespace-pre-wrap">{brief.deliveredNote}</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card-v0 p-5 space-y-2">
            <h2 className="font-semibold text-sm mb-1">Team</h2>
            {brief.assignee ? (
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-400 flex items-center justify-center text-white text-xs font-semibold">
                  {(brief.assignee.name ?? brief.assignee.email)[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{brief.assignee.name ?? brief.assignee.email}</div>
                  <div className="text-xs text-ink-500">Designer / Freelancer</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-500 italic">Unassigned — open for claim</div>
            )}
            <hr className="border-ink-100 my-2" />
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-ink-100 flex items-center justify-center text-ink-600 text-xs font-semibold">
                {(brief.creator.name ?? brief.creator.email)[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-medium">{brief.creator.name ?? brief.creator.email}</div>
                <div className="text-xs text-ink-500">Brief creator</div>
              </div>
            </div>
          </div>

          {/* Workflow hint */}
          <div className="card-v0 p-5 bg-gradient-to-br from-brand-50 to-accent-50">
            <h2 className="font-semibold text-sm mb-2">Workflow</h2>
            <ol className="text-xs space-y-1.5 text-ink-700">
              <li className={brief.status === "OPEN" ? "font-bold text-brand-700" : ""}>1. OPEN — claimable by any designer</li>
              <li className={brief.status === "CLAIMED" ? "font-bold text-brand-700" : ""}>2. CLAIMED — picked up</li>
              <li className={brief.status === "IN_PROGRESS" ? "font-bold text-brand-700" : ""}>3. IN_PROGRESS — work in motion</li>
              <li className={brief.status === "IN_REVIEW" ? "font-bold text-brand-700" : ""}>4. IN_REVIEW — delivered, awaiting accept</li>
              <li className={brief.status === "DELIVERED" ? "font-bold text-brand-700" : ""}>5. DELIVERED — accepted, ready for ads</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
