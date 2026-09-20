import { NextResponse } from "next/server";
import { requireSession, checkTier } from "@/lib/session";
import { recomputeContentPatterns, suggestCreative } from "@/lib/intelligence/content-engine";
import { prisma } from "@/lib/db";
import { OrgTier } from "@/lib/constants";

export async function GET() {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  // Content Intelligence is PRO+ tier, and patterns are org-scoped (per-org learning).
  checkTier(session.orgTier, OrgTier.PRO);
  const patterns = await prisma.contentPattern.findMany({
    where: { orgId: session.orgId },
    orderBy: [{ confidence: "desc" }, { roas: "desc" }],
    take: 200
  });
  return NextResponse.json(patterns);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  checkTier(session.orgTier, OrgTier.PRO);
  const body = await req.json();

  if (body.action === "recompute") {
    const result = await recomputeContentPatterns(session.orgId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "suggest") {
    const result = await suggestCreative(session.orgId, {
      industry: body.industry ?? "Other",
      audience: body.audience ?? "general",
      platform: body.platform ?? "META",
      goal: body.goal ?? "lead_gen"
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
