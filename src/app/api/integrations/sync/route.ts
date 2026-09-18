import { NextRequest } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";
import { getConnector, getAllConnectors } from "@/server/integrations/registry";
import { prisma } from "@/lib/db";

const syncSchema = z.object({
  provider: z.string().optional() // if omitted, sync all
});

export const POST = authedRoute(syncSchema, async (ctx, body) => {
  const providers = body.provider ? [body.provider] : Object.keys(getAllConnectors());
  const results: any[] = [];
  for (const p of providers) {
    try {
      const conn = getConnector(p);
      const result = await conn.sync({ orgId: ctx.orgId });
      // Update integration health in DB
      const status = !conn.isConfigured()
        ? "DISABLED"
        : result.ok
          ? "HEALTHY"
          : result.errors.length > 0
            ? "DEGRADED"
            : "HEALTHY";
      await prisma.integration.upsert({
        where: { orgId_provider: { orgId: ctx.orgId, provider: p } },
        update: {
          status,
          lastSyncAt: new Date(),
          errorMessage: result.errors[0] ?? null
        },
        create: {
          orgId: ctx.orgId,
          provider: p,
          status,
          lastSyncAt: new Date()
        }
      });
      results.push({ provider: p, ...result, configured: conn.isConfigured() });
    } catch (e: any) {
      results.push({ provider: p, ok: false, errors: [e.message], itemsProcessed: 0, durationMs: 0 });
    }
  }
  return { results };
});