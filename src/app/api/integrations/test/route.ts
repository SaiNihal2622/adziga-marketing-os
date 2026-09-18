import { NextRequest } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";
import { getConnector, getAllConnectors } from "@/server/integrations/registry";
import { prisma } from "@/lib/db";

const schema = z.object({
  provider: z.string().optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  const providers = body.provider ? [body.provider] : Object.keys(getAllConnectors());
  const results: any[] = [];
  for (const p of providers) {
    try {
      const conn = getConnector(p);
      const r = await conn.testConnection();
      // Update integration health
      await prisma.integration.upsert({
        where: { orgId_provider: { orgId: ctx.orgId, provider: p } },
        update: {
          status: !conn.isConfigured() ? "DISABLED" : r.ok ? "HEALTHY" : "FAILED",
          errorMessage: r.ok ? null : (r.detail ?? null)
        },
        create: {
          orgId: ctx.orgId,
          provider: p,
          status: !conn.isConfigured() ? "DISABLED" : r.ok ? "HEALTHY" : "FAILED",
          errorMessage: r.ok ? null : (r.detail ?? null)
        }
      });
      results.push({ provider: p, configured: conn.isConfigured(), ...r });
    } catch (e: any) {
      results.push({ provider: p, ok: false, detail: e.message });
    }
  }
  return { results };
});