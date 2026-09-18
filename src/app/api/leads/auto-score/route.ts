import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { scoreLead, fire } from "@/lib/intelligence/lead-router";
import { prisma } from "@/lib/db";

// Auto-score + auto-assign leads
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = await req.json();
  const where: any = { orgId: session.orgId };
  if (body.unscoredOnly !== false) where.score = { equals: 0 };
  if (body.clientId) where.clientId = body.clientId;

  const leads = await prisma.lead.findMany({ where, take: 200 });
  const results: any[] = [];

  for (const l of leads) {
    const score = scoreLead({
      source: l.source,
      city: l.city,
      email: l.email,
      phone: l.phone,
      campaignId: l.campaignId
    });
    await prisma.leadScore.upsert({
      where: { leadId: l.id },
      update: { score, factors: JSON.stringify({ source: l.source, city: l.city }), computedAt: new Date() },
      create: { orgId: l.orgId, leadId: l.id, score, factors: JSON.stringify({ source: l.source, city: l.city }) }
    });
    await prisma.lead.update({ where: { id: l.id }, data: { score } }).catch(() => null);

    // Fire lead.created event to trigger any matching automations
    await fire({
      trigger: "lead.created",
      orgId: l.orgId,
      entityType: "Lead",
      entityId: l.id,
      payload: {
        leadId: l.id,
        source: l.source,
        city: l.city,
        score,
        campaignId: l.campaignId
      }
    });

    results.push({ id: l.id, score });
  }

  return NextResponse.json({ scored: results.length, results });
}

export async function GET() {
  const scores = await prisma.leadScore.findMany({
    orderBy: { computedAt: "desc" },
    take: 50
  });
  return NextResponse.json(scores);
}