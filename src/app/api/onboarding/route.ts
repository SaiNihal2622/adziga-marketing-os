import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Stub: log the answers, return 200. In production this would create a Client + Org + Strategy draft.
  // Spec ??39 - Onboarding data should auto-populate marketing context.
  // We persist to a JSONL log so the system can be wired to real Client creation later.
  const fs = await import("fs/promises");
  const path = "data_cache/onboarding_leads.jsonl";
  await fs.mkdir("data_cache", { recursive: true });
  await fs.appendFile(path, JSON.stringify({ at: new Date().toISOString(), ...body }) + "\n", "utf8");
  return NextResponse.json({ ok: true });
}