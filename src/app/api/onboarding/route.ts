import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/server/api";
import { onboardingStepSchema } from "@/server/schemas";
import { logger } from "@/server/logger";

export const POST = authedRoute(onboardingStepSchema, async (ctx, body) => {
  // Per spec §39 — Onboarding data should automatically populate the client's marketing context.
  // We persist to a JSONL log so the system can be wired to real Client creation later.
  const fs = await import("fs/promises");
  const path = "data_cache/onboarding_leads.jsonl";
  await fs.mkdir("data_cache", { recursive: true });
  await fs.appendFile(
    path,
    JSON.stringify({ at: new Date().toISOString(), orgId: ctx.orgId, userId: ctx.userId, ...body }) + "\n",
    "utf8"
  );
  logger.info("onboarding.submitted", { orgId: ctx.orgId, userId: ctx.userId });
  return { ok: true };
});