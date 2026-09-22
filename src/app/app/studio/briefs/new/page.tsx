// /app/studio/briefs/new — create a designer brief
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BriefForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewBriefPage({
  searchParams
}: {
  searchParams: { clientId?: string; campaignId?: string }
}) {
  const session = await getSession();
  if (!session) return null;

  const [clients, campaigns, designers] = await Promise.all([
    prisma.client.findMany({
      where: { orgId: session.orgId },
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true }
    }),
    prisma.campaign.findMany({
      where: { orgId: session.orgId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, name: true, client: { select: { id: true, businessName: true } } }
    }),
    prisma.user.findMany({
      where: {
        memberships: { some: { orgId: session.orgId, role: { in: ["DESIGNER", "FREELANCER"] } } }
      },
      select: { id: true, name: true, email: true, image: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">New designer brief</h1>
        <p className="text-sm text-ink-500 mt-1">
          Specify what you need, who's producing it, and when it's due. The assignee (or any open-claim designer) gets a notification.
        </p>
      </header>

      <BriefForm
        clients={clients}
        campaigns={campaigns}
        designers={designers}
        defaultClientId={searchParams.clientId}
        defaultCampaignId={searchParams.campaignId}
      />
    </div>
  );
}
