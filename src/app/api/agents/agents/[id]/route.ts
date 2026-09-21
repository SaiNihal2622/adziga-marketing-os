// GET    /api/agents/agents/[id]     — full agent detail
// PATCH  /api/agents/agents/[id]     — update name, permissions, tools, enabled, trigger, cron
// DELETE /api/agents/agents/[id]     — soft-delete (enabled=false)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.string().max(2000).optional(),
  tools: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  trigger: z.enum(["manual", "cron", "event"]).optional(),
  cronExpr: z.string().max(100).nullable().optional(),
  triggerEvent: z.string().max(100).nullable().optional()
});

export const GET = authedRoute({} as any, async (ctx, _b, params) => {
  const agent = await ctx.prisma.agent.findFirst({
    where: { id: params.id, orgId: ctx.orgId }
  });
  if (!agent) return { error: "NOT_FOUND" };
  return { agent };
});

export const PATCH = authedRoute(patchSchema, async (ctx, body, params) => {
  const existing = await ctx.prisma.agent.findFirst({
    where: { id: params.id, orgId: ctx.orgId }
  });
  if (!existing) return { error: "NOT_FOUND" };
  const updated = await ctx.prisma.agent.update({
    where: { id: params.id },
    data: body
  });
  await ctx.prisma.auditLog.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: "agent.update",
      entityType: "Agent",
      entityId: params.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated)
    }
  });
  return { agent: updated };
});

export const DELETE = authedRoute({} as any, async (ctx, _b, params) => {
  await ctx.prisma.agent.update({
    where: { id: params.id },
    data: { enabled: false }
  });
  await ctx.prisma.auditLog.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: "agent.disabled",
      entityType: "Agent",
      entityId: params.id
    }
  });
  return { ok: true };
});
