import { NextRequest, NextResponse } from "next/server";
import { requireSession, checkTier, audit } from "@/lib/session";
import { generateOrchestrationPlan, transitionPlan, deployPlan } from "@/lib/intelligence/orchestration-engine";
import { prisma } from "@/lib/db";
import { OrgTier } from "@/lib/constants";
import { NotFoundError } from "@/server/errors";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  // Orchestration (multi-step campaigns) is ZIGA Plus tier.
  checkTier(session.orgTier, OrgTier.ZIGA_PLUS);

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

  await audit(session.orgId, session.userId, "orchestration.plan.created", {
    entityType: "OrchestrationPlan",
    entityId: plan.planId
  });

  return NextResponse.json(plan);
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const url = new URL(req.url);
  const planId = url.searchParams.get("planId");
  if (planId) {
    // Org-scoped lookup: only return the plan if it belongs to the active org.
    const plan = await prisma.orchestrationPlan.findFirst({
      where: { id: planId, orgId: session.orgId },
      include: { campaigns: true }
    });
    if (!plan) throw new NotFoundError("Plan not found");
    return NextResponse.json(plan);
  }
  const plans = await prisma.orchestrationPlan.findMany({
    where: { orgId: session.orgId },
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

  // Org-scoped guard: refuse to operate on a plan that doesn't belong to this org.
  const plan = await prisma.orchestrationPlan.findFirst({
    where: { id: body.planId, orgId: session.orgId },
    select: { id: true, status: true }
  });
  if (!plan) throw new NotFoundError("Plan not found");

  if (body.action === "deploy") {
    const result = await deployPlan(body.planId, session.orgId);
    await audit(session.orgId, session.userId, "orchestration.plan.deployed", { entityType: "OrchestrationPlan", entityId: body.planId });
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

  await transitionPlan(body.planId, to, session.userId, session.orgId);
  await audit(session.orgId, session.userId, "orchestration.plan.transition", {
    entityType: "OrchestrationPlan",
    entityId: body.planId,
    before: { status: plan.status },
    after: { status: to, action: body.action }
  });
  return NextResponse.json({ ok: true, status: to });
}
