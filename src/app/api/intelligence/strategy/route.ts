import { NextRequest, NextResponse } from "next/server";
import { requireSession, checkTier } from "@/lib/session";
import { recommendStrategy, seedBenchmarks } from "@/lib/intelligence/strategy-engine";
import { prisma } from "@/lib/db";
import { OrgTier } from "@/lib/constants";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  // Strategy Intelligence is ZIGA Plus tier only.
  checkTier(session.orgTier, OrgTier.ZIGA_PLUS);

  const body = await req.json();
  if (!body.industry || !body.objective || !body.monthlyBudget) {
    return NextResponse.json({ error: "industry, objective, monthlyBudget required" }, { status: 400 });
  }

  // Make sure benchmarks exist
  await seedBenchmarks();

  const result = await recommendStrategy({
    orgId: session.orgId,
    industry: body.industry,
    objective: body.objective,
    monthlyBudget: Number(body.monthlyBudget),
    region: body.region ?? "IN",
    clientId: body.clientId,
    audience: body.audience
  });

  return NextResponse.json(result);
}

export async function GET() {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  // Org-scoped — was returning all orgs' recommendations before.
  const recs = await prisma.strategyRecommendation.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  return NextResponse.json(recs);
}
