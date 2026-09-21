// /app/creatives — creatives library
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CreativeCard } from "./_creative-card";
import { CreativeFilters } from "./_filters";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["DRAFT", "IN_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "ARCHIVED"];
const VALID_FORMAT = ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"];
const VALID_SOURCE = ["AI_GENERATED", "CLIENT_UPLOAD", "DESIGNER", "STOCK", "USER_TEMPLATE"];

export default async function CreativesPage({
  searchParams
}: {
  searchParams: { status?: string; format?: string; source?: string; q?: string; campaignId?: string }
}) {
  const session = await getSession();
  if (!session) return null;

  const where: any = { orgId: session.orgId };
  if (searchParams.status && VALID_STATUS.includes(searchParams.status)) where.status = searchParams.status;
  if (searchParams.format && VALID_FORMAT.includes(searchParams.format)) where.format = searchParams.format;
  if (searchParams.source && VALID_SOURCE.includes(searchParams.source)) where.source = searchParams.source;
  if (searchParams.campaignId) where.campaignId = searchParams.campaignId;
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { headline: { contains: searchParams.q, mode: "insensitive" } },
      { primaryCopy: { contains: searchParams.q, mode: "insensitive" } }
    ];
  }

  const [creatives, totalCount, byStatus, recentCampaigns] = await Promise.all([
    prisma.creative.findMany({
      where,
      take: 60,
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: { select: { id: true, name: true, client: { select: { businessName: true } } } }
      }
    }),
    prisma.creative.count({ where: { orgId: session.orgId } }),
    prisma.creative.groupBy({
      by: ["status"],
      where: { orgId: session.orgId },
      _count: true
    }),
    prisma.campaign.findMany({
      where: { orgId: session.orgId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, client: { select: { businessName: true } } }
    })
  ]);

  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b._count]));
  const activeFilters = Object.entries(searchParams).filter(([, v]) => Boolean(v));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creatives</h1>
          <p className="text-sm text-ink-500 mt-1">
            Every visual, every line of copy. {totalCount} total — produced by AI, your designers, or your clients.
          </p>
        </div>
        <Link href="/app/creatives/new" className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New creative
        </Link>
      </header>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <Link href="/app/creatives" className={`pill ${!searchParams.status ? "pill-active" : "pill-inactive"}`}>
          All <span className="text-ink-400">{totalCount}</span>
        </Link>
        {VALID_STATUS.map((s) => (
          <Link key={s} href={`/app/creatives?status=${s}`} className={`pill ${searchParams.status === s ? "pill-active" : "pill-inactive"}`}>
            {statusLabel(s)} <span className="text-ink-400">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      <CreativeFilters
        searchParams={searchParams}
        campaigns={recentCampaigns.map((c) => ({ id: c.id, name: `${c.client.businessName} · ${c.name}` }))}
        activeFilters={activeFilters}
      />

      {creatives.length === 0 ? (
        <EmptyState hasFilters={activeFilters.length > 0} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {creatives.map((c) => (
            <CreativeCard key={c.id} creative={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  return { DRAFT: "Draft", IN_REVIEW: "In review", APPROVED: "Approved", ACTIVE: "Active", PAUSED: "Paused", ARCHIVED: "Archived" }[s] ?? s;
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="card-v0 p-12 text-center">
      <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 flex items-center justify-center text-brand-600 mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink-900">
        {hasFilters ? "No creatives match those filters" : "No creatives yet"}
      </h2>
      <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
        {hasFilters
          ? "Try clearing filters or create a new creative that matches your search."
          : "Generate AI images and copy, upload client files, or have your designer drop assets in. Everything lives here in the library."}
      </p>
      <Link href="/app/creatives/new" className="btn btn-primary mt-6 inline-flex">
        Create the first creative
      </Link>
    </div>
  );
}
