import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { generateOrchestrationPlan, transitionPlan, deployPlan } from "@/lib/intelligence/orchestration-engine";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = await req.json();

  if (!body.goalType || !body.goalQuantity || !body.goalDeadline) {
    return NextResponse.json({ error: "goalType, goalQuantity, goalDeadline required" }, { status: 400 });
  }

  const plan = await generateOrchestrationPlan({
    orgId: session.orgId,
    clientId: body.clientId,
    authorId: session.userId,
    goalType: body.goalType,
    goalQuantity: Number(body.goalQuantity),
    goalMetric: body.goalMetric ?? "qualified_leads",
    goalDeadline: new Date(body.goalDeadline),
    goalNotes: body.goalNotes
  });

  return NextResponse.json(plan);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const planId = url.searchParams.get("planId");
  if (planId) {
    const plan = await prisma.orchestrationPlan.findUnique({
      where: { id: planId },
      include: { campaigns: true }
    });
    return NextResponse.json(plan);
  }
  const plans = await prisma.orchestrationPlan.findMany({
    include: { campaigns: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json(plans);
}

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = await req.json();
  if (!body.planId || !body.action) return NextResponse.json({ error: "planId and action required" }, { status: 400 });

  if (body.action === "deploy") {
    const result = await deployPlan(body.planId);
    return NextResponse.json(result);
  }

  const transitionMap: Record<string, string> = {
    submit_internal_review: "INTERNAL_REVIEW",
    submit_client_approval: "CLIENT_APPROVAL",
    approve: "APPROVED",
    cancel: "CANCELLED",
    fail: "FAILED"
  };
  const to = transitionMap[body.action];
  if (!to) return NextResponse.json({ error: "unknown action" }, { status: 400 });

  await transitionPlan(body.planId, to, session.userId);
  return NextResponse.json({ ok: true, status: to });
}