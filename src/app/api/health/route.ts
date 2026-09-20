// Adziga — Public health check endpoint
// Returns 200 if all critical subsystems are up. Used by uptime monitors
// (UptimeRobot, BetterStack, etc.) and by /api/status on the marketing site.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = { ok: boolean; latencyMs: number; detail?: string };

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: e?.message ?? "db error" };
  }
}

async function checkGemini(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
  if (!key) return { ok: false, latencyMs: 0, detail: "GEMINI_API_KEY not configured" };
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key, {
      signal: AbortSignal.timeout(5000)
    });
    return { ok: r.ok, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: e?.message ?? "fetch error" };
  }
}

async function checkResend(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, latencyMs: 0, detail: "RESEND_API_KEY not configured" };
  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(5000)
    });
    return { ok: r.ok, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: e?.message ?? "fetch error" };
  }
}

export async function GET() {
  const [db, gemini, resend] = await Promise.all([checkDb(), checkGemini(), checkResend()]);
  const checks = { db, gemini, resend };
  const allOk = db.ok; // DB is critical; other integrations can be down without affecting uptime
  return NextResponse.json(
    {
      ok: allOk,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      checks
    },
    { status: allOk ? 200 : 503 }
  );
}
