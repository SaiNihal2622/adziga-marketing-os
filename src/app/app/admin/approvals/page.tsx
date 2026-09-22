// Adziga — /app/admin/approvals
// The "const control" view for the Adziga team. Every client-initiated change
// to a critical field lands here. Admins review the proposed payload,
// approve to apply, or reject with notes.

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { ApprovalQueue } from "./_queue";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams: { status?: string };
}) {
  const session = await requireSession();
  const filter = (searchParams.status ?? "pending") as "pending" | "applied" | "rejected" | "cancelled" | "approved" | "all";

  const where: any = { orgId: session.orgId };
  if (filter !== "all") where.status = filter;

  const [items, counts] = await Promise.all([
    prisma.approval.findMany({
      where,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 200,
      include: {
        approver: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.approval.groupBy({
      by: ["status"],
      where: { orgId: session.orgId },
      _count: { _all: true }
    })
  ]);

  const countMap = counts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Approvals"
        subtitle="Client-initiated changes to important settings (budgets, tiers, campaign status) are staged here. Approve to apply, reject to discard."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Approvals" }]}
      />

      <ApprovalQueue
        initialItems={items.map((a) => ({
          id: a.id,
          orgId: a.orgId,
          entityType: a.entityType,
          entityId: a.entityId,
          action: a.action,
          title: a.title,
          payload: a.payload ? safeParse(a.payload) : null,
          requestedById: a.requestedById,
          requestedByKind: a.requestedByKind,
          severity: a.severity,
          reason: a.reason,
          status: a.status,
          notes: a.notes,
          requestedAt: a.requestedAt.toISOString(),
          decidedAt: a.decidedAt?.toISOString() ?? null,
          approver: a.approver ? { id: a.approver.id, name: a.approver.name, email: a.approver.email } : null
        }))}
        counts={countMap}
        activeFilter={filter}
      />
    </div>
  );
}

function safeParse(json: string): Record<string, unknown> | null {
  try { return JSON.parse(json); } catch { return null; }
}
