// /app/creatives/new — AI gen, upload, or fill-in form
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CreativeCreator } from "./_creator";

export const dynamic = "force-dynamic";

export default async function NewCreativePage({
  searchParams
}: {
  searchParams: { campaignId?: string; clientId?: string }
}) {
  const session = await getSession();
  if (!session) return null;

  const [clients, campaigns] = await Promise.all([
    prisma.client.findMany({
      where: { orgId: session.orgId },
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true, industry: true }
    }),
    prisma.campaign.findMany({
      where: { orgId: session.orgId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, name: true, client: { select: { id: true, businessName: true } } }
    })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Create a creative</h1>
        <p className="text-sm text-ink-500 mt-1">
          Generate with AI, upload a client file, or hand-craft the brief and let your designer run with it.
        </p>
      </header>

      <CreativeCreator
        clients={clients}
        campaigns={campaigns}
        defaultCampaignId={searchParams.campaignId}
        defaultClientId={searchParams.clientId}
      />
    </div>
  );
}
