// Adziga — Client error endpoint
// Called from src/app/error.tsx when a client-side exception escapes the
// React boundary. Persists a slim AuditLog row so the team can spot
// regressions without users having to file a ticket.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/server/api";

const schema = z.object({
  digest: z.string().max(64).optional(),
  message: z.string().max(1000),
  stack: z.string().max(4000).optional(),
  url: z.string().max(2000).optional(),
  ua: z.string().max(1000).optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  // Don't crash the endpoint if the body is malformed
  await import("@/lib/db").then(({ prisma }) =>
    prisma.auditLog
      .create({
        data: {
          orgId: ctx.orgId,
          userId: ctx.userId,
          action: "client.error",
          entityType: "ClientError",
          entityId: body.digest,
          after: JSON.stringify({
            message: body.message,
            url: body.url,
            ua: body.ua?.slice(0, 200),
            stack: body.stack?.slice(0, 1000)
          })
        }
      })
      .catch(() => null)
  );
  return { ok: true };
});
