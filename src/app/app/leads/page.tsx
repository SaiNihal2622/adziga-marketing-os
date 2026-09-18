import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { LeadsWorkspace } from "./leads-workspace";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: { clientId?: string; status?: string; source?: string; q?: string };
}) {
  const session = await requireSession();
  const where: any = { orgId: session.orgId };
  if (searchParams.clientId) where.clientId = searchParams.clientId;
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.source) where.source = searchParams.source;
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q } },
      { email: { contains: searchParams.q } },
      { phone: { contains: searchParams.q } },
      { city: { contains: searchParams.q } }
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { client: true, campaign: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  // Fetch owners so we can show real names/avatars in the workspace
  const ownerIds = Array.from(
    new Set(leads.map((l) => l.ownerId).filter((id): id is string => Boolean(id)))
  );
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const ownerMap: Record<string, { name: string | null; email: string | null }> = {};
  for (const o of owners) ownerMap[o.id] = { name: o.name, email: o.email };

  return <LeadsWorkspace initialLeads={leads as any} ownerMap={ownerMap} />;
}
