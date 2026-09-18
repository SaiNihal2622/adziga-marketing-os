import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { runScheduledJob } from "@/lib/intelligence/scheduler";
import { prisma } from "@/lib/db";

// POST /api/automations/run { name: "automations.tick" | "campaign.health_check" | "intelligence.recompute" | "integration.health_check" }
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const result = await runScheduledJob(body.name);
  return NextResponse.json(result);
}

// GET - list recent runs
export async function GET() {
  const [jobs, runs] = await Promise.all([
    prisma.backgroundJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.workflowRun.findMany({ orderBy: { startedAt: "desc" }, take: 50 })
  ]);
  return NextResponse.json({ jobs, runs });
}