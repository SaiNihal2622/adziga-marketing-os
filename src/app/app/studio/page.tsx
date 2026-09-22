// /app/studio — designer + freelancer dashboard
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<string, string> = {
  OPEN: "bg-brand-50 text-brand-700 ring-brand-200",
  CLAIMED: "bg-amber-50 text-amber-700 ring-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-ink-50 text-ink-500 ring-ink-200"
};

const PRIORITY_TINT: Record<string, string> = {
  LOW: "bg-ink-100 text-ink-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700"
};

export default async function StudioPage({
  searchParams
}: {
  searchParams: { status?: string; view?: "all" | "mine" }
}) {
  const session = await getSession();
  if (!session) return null;

  // "Mine" = assigned to me OR unclaimed (designers can pick up open briefs)
  const view = searchParams.view ?? (session.role === "DESIGNER" || session.role === "FREELANCER" ? "mine" : "all");

  const where: any = { orgId: session.orgId };
  if (searchParams.status) where.status = searchParams.status;
  if (view === "mine") {
    where.OR = [
      { assigneeId: session.userId },
      { status: "OPEN" } // anyone in the studio can see open briefs to claim
    ];
  }

  const [briefs, allCounts, mineCounts] = await Promise.all([
    prisma.brief.findMany({
      where,
      take: 60,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { businessName: true } },
        campaign: { select: { name: true } },
        assignee: { select: { name: true, email: true, image: true } },
        creator: { select: { name: true, email: true } }
      }
    }),
    prisma.brief.groupBy({ by: ["status"], where: { orgId: session.orgId }, _count: true }),
    prisma.brief.groupBy({
      by: ["status"],
      where: {
        orgId: session.orgId,
        OR: [{ assigneeId: session.userId }, { status: "OPEN" }]
      },
      _count: true
    }) as any
  ]);

  const all = Object.fromEntries(allCounts.map((c: any) => [c.status, c._count]));
  const mine = Object.fromEntries(mineCounts.map((c: any) => [c.status, c._count]));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
          <p className="text-sm text-ink-500 mt-1">
            {session.role === "DESIGNER" || session.role === "FREELANCER"
              ? "Your briefs — claim open ones, deliver in-progress work, see what's in review."
              : "Designer briefs — assign work, review submissions, mark delivered."}
          </p>
        </div>
        <Link href="/app/studio/briefs/new" className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New brief
        </Link>
      </header>

      {/* View toggle */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/app/studio?view=all"
          className={`pill ${view === "all" ? "pill-active" : "pill-inactive"}`}
        >
          All <span className="text-ink-400">{Object.values(all).reduce((s: number, n: any) => s + Number(n), 0)}</span>
        </Link>
        <Link
          href="/app/studio?view=mine"
          className={`pill ${view === "mine" ? "pill-active" : "pill-inactive"}`}
        >
          {session.role === "DESIGNER" || session.role === "FREELANCER" ? "My queue" : "Unassigned + Mine"}
          <span className="text-ink-400">{Object.values(mine).reduce((s: number, n: any) => s + Number(n), 0)}</span>
        </Link>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/studio?view=${view}`}
          className={`pill ${!searchParams.status ? "pill-active" : "pill-inactive"}`}
        >
          All statuses
        </Link>
        {["OPEN", "CLAIMED", "IN_PROGRESS", "IN_REVIEW", "DELIVERED", "ARCHIVED"].map((s) => (
          <Link
            key={s}
            href={`/app/studio?view=${view}&status=${s}`}
            className={`pill ${searchParams.status === s ? "pill-active" : "pill-inactive"}`}
          >
            {STATUS_TINT[s] && (
              <span className={`size-1.5 rounded-full ${STATUS_TINT[s].split(" ")[0]}`} aria-hidden />
            )}
            {s.replace("_", " ")} <span className="text-ink-400">{Number((view === "mine" ? mine : all)[s] ?? 0)}</span>
          </Link>
        ))}
      </div>

      {briefs.length === 0 ? (
        <EmptyState role={session.role} view={view} />
      ) : (
        <div className="space-y-2">
          {briefs.map((b: any) => (
            <BriefRow key={b.id} brief={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BriefRow({ brief }: { brief: any }) {
  const due = brief.dueDate ? new Date(brief.dueDate) : null;
  const overdue = due && due < new Date() && brief.status !== "DELIVERED";
  return (
    <Link
      href={`/app/studio/briefs/${brief.id}`}
      className="card-v0 p-4 flex items-center gap-4 hover:border-ink-300 hover:shadow-sm transition-all group"
    >
      {/* Priority badge */}
      <div className={`shrink-0 size-10 rounded-lg flex items-center justify-center text-xs font-bold ${PRIORITY_TINT[brief.priority] ?? PRIORITY_TINT.NORMAL}`}>
        {brief.priority === "URGENT" ? "!" : brief.priority === "HIGH" ? "↑" : brief.priority === "LOW" ? "↓" : "·"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-ink-900 group-hover:text-brand-600 transition-colors truncate">
            {brief.title}
          </h3>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_TINT[brief.status]}`}>
            {brief.status.replace("_", " ")}
          </span>
          {brief.format && <span className="text-[10px] uppercase tracking-wide text-ink-500">{brief.format}</span>}
          {brief.platform && <span className="text-[10px] uppercase tracking-wide text-ink-500">{brief.platform}</span>}
        </div>
        <p className="text-sm text-ink-500 line-clamp-1 mt-0.5">{brief.brief}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-500 flex-wrap">
          {brief.client?.businessName && <span>📦 {brief.client.businessName}</span>}
          {brief.campaign?.name && <span>🎯 {brief.campaign.name}</span>}
          {brief.assignee && (
            <span className="inline-flex items-center gap-1">
              <span className="size-4 rounded-full bg-gradient-to-br from-brand-400 to-accent-400 inline-block" aria-hidden />
              {brief.assignee.name ?? brief.assignee.email}
            </span>
          )}
          {!brief.assignee && brief.status === "OPEN" && <span className="italic text-brand-600">Unclaimed — claim it</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {due && (
          <div className={`text-xs font-medium ${overdue ? "text-red-600" : "text-ink-600"}`}>
            {overdue ? "⚠ " : ""}{due.toLocaleDateString()}
          </div>
        )}
        <div className="text-[10px] text-ink-400 mt-0.5">
          {new Date(brief.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ role, view }: { role: string; view: string }) {
  return (
    <div className="card-v0 p-12 text-center">
      <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 flex items-center justify-center text-brand-600 mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h6M9 13h6M9 17h6" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink-900">
        {role === "DESIGNER" || role === "FREELANCER"
          ? view === "mine" ? "No briefs in your queue" : "No briefs yet"
          : "No briefs match these filters"}
      </h2>
      <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
        {role === "DESIGNER" || role === "FREELANCER"
          ? "Check the All view for open briefs you can claim, or wait for your team to assign work."
          : "Create a brief when you need a designer or freelancer to produce something — copy, visuals, video, landing pages."}
      </p>
    </div>
  );
}
