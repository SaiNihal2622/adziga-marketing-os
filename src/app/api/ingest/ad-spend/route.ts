// Adziga — /api/ingest/ad-spend
// Sprint 10a — bulk ad-spend ingestion endpoint.
//
// Two auth modes:
//   1. Session (admin UI): regular authedRoute with FOUNDER/ADMIN role.
//   2. Bearer token: org-scoped ingestion token minted from /api/admin/ingestion-token.
//      Lets external jobs (Meta cron, Google Ads poller, manual script) push
//      daily spend rows without sharing user credentials.
//
// Body:
//   { rows: SpendRow[] }
//   SpendRow = { campaignId? | campaignExternalId?, date, amount, platform, currency?, source? }

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { getSession } from "@/lib/session";
import { AdSpendIngestionService, type SpendRow } from "@/server/services/ad-spend-ingestion";
import { Role } from "@/lib/constants";

const Body = z.object({
  rows: z.array(
    z.object({
      campaignId: z.string().optional(),
      campaignExternalId: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number().nonnegative(),
      platform: z.string().min(1).max(40),
      currency: z.string().optional(),
      source: z.string().optional()
    })
  ).min(1).max(10000)
});

export async function POST(req: Request) {
  // Auth: try session first, then bearer.
  const session = await getSession();
  let orgId: string | null = null;
  let userId: string | null = null;

  if (session) {
    orgId = (session as any).orgId;
    userId = (session as any).userId;
    // For session auth, require FOUNDER/ADMIN role.
    const role = (session as any).role;
    if (role !== Role.FOUNDER && role !== Role.ADMIN) {
      return new Response(JSON.stringify({ error: "FOUNDER or ADMIN role required" }), { status: 403 });
    }
  } else {
    // Bearer-token auth.
    const auth = req.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
    }
    const presented = m[1].trim();
    // Token format: adz_ing_<orgId8>_<32hex> — extract orgId from prefix.
    const orgMatch = presented.match(/^adz_ing_([a-z0-9]+)_/i);
    if (!orgMatch) {
      return new Response(JSON.stringify({ error: "malformed token" }), { status: 401 });
    }
    // Resolve orgId by reading the Organization row whose slug starts with
    // the token prefix is not enough — we need to verify the token actually
    // matches the stored token for that org. Lookup by metadata JSON.
    const { prisma } = await import("@/lib/db");
    // Try matching the full org id by checking metadata field across orgs.
    // (Token stores full orgId, not prefix — but we only have the prefix from
    // the token. So we do a more targeted lookup.)
    const candidate = await prisma.organization.findMany({
      where: { metadata: { contains: presented } },
      select: { id: true, metadata: true }
    });
    const ok = candidate.find((c) => {
      try {
        const meta = JSON.parse(c.metadata ?? "{}");
        return meta.ingestionToken === presented;
      } catch {
        return false;
      }
    });
    if (!ok) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
    }
    orgId = ok.id;
  }

  if (!orgId) {
    return new Response(JSON.stringify({ error: "could not determine org" }), { status: 401 });
  }

  // Parse + validate body
  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "VALIDATION", issues: parsed.error.issues }), { status: 422 });
  }

  const result = await AdSpendIngestionService.upsertDailySpend(orgId, parsed.data.rows as SpendRow[], {
    userId: userId ?? undefined
  });
  return new Response(JSON.stringify(result), { status: 200 });
}

// Allow GET so curl can sanity-check auth without sending data.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true, endpoint: "POST daily ad-spend rows here" }), { status: 200 });
}
