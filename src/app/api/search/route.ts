import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json([]);
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const [clients, campaigns, leads, creatives, events, influencers] = await Promise.all([
    prisma.client.findMany({
      where: { orgId: session.orgId, businessName: { contains: q } },
      take: 4
    }),
    prisma.campaign.findMany({
      where: { orgId: session.orgId, name: { contains: q } },
      take: 4
    }),
    prisma.lead.findMany({
      where: { orgId: session.orgId, OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] },
      take: 4
    }),
    prisma.creative.findMany({
      where: { orgId: session.orgId, name: { contains: q } },
      take: 4
    }),
    prisma.marketingEvent.findMany({
      where: { orgId: session.orgId, name: { contains: q } },
      take: 4
    }),
    prisma.influencer.findMany({
      where: { orgId: session.orgId, OR: [{ name: { contains: q } }, { handle: { contains: q } }] },
      take: 4
    })
  ]);

  const results = [
    ...clients.map((c) => ({ kind: "Client", id: c.id, title: c.businessName, subtitle: c.industry ?? "", href: `/app/clients/${c.id}` })),
    ...campaigns.map((c) => ({ kind: "Campaign", id: c.id, title: c.name, subtitle: `${c.platform} - ${c.status}`, href: `/app/campaigns/${c.id}` })),
    ...leads.map((l) => ({ kind: "Lead", id: l.id, title: l.name ?? l.email ?? "Lead", subtitle: `${l.status} - ${l.city ?? ""}`, href: `/app/leads/${l.id}` })),
    ...creatives.map((c) => ({ kind: "Creative", id: c.id, title: c.name, subtitle: `${c.format} - ${c.platform}`, href: `/app/creatives/${c.id}` })),
    ...events.map((e) => ({ kind: "Event", id: e.id, title: e.name, subtitle: `${e.type} - ${e.status}`, href: `/app/events/${e.id}` })),
    ...influencers.map((i) => ({ kind: "Influencer", id: i.id, title: i.name, subtitle: `${i.platform} - ${i.handle}`, href: `/app/influencers/${i.id}` }))
  ];

  return NextResponse.json(results.slice(0, 12));
}