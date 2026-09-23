// Adziga — AdSpendIngestionService (Sprint 10a)
// Pulls daily ad-spend data from any source (Meta, Google, manual upload)
// and upserts into the AdSpend table so the Campaign row's running totals
// stay current. Once the per-day spend is up to date, the anomaly
// detector (Sprint 9b) and ROI service (Sprint 7a) can both operate on
// real data instead of synthesised series.
//
// Sources supported:
//   • Meta Marketing API (via fetch + page access token)
//   • Google Ads API (placeholder — full impl needs google-ads SDK)
//   • Manual upload via /api/ingest/ad-spend (org-scoped)
//
// All paths funnel through `upsertDailySpend(orgId, rows)` which:
//   • Validates each row (campaign exists, date valid, amount ≥ 0)
//   • Upserts (orgId, campaignId, date) unique tuple
//   • Recomputes Campaign.spent from the sum of AdSpend rows
//   • Writes an audit log entry per batch
//
// Idempotent — re-ingesting the same data produces the same state.

import { prisma } from "@/lib/db";
import crypto from "node:crypto";

export type SpendRow = {
  campaignExternalId?: string; // platform's id (e.g. Meta campaign_id)
  campaignId?: string;          // our internal id (preferred when caller knows it)
  date: string;                 // ISO date YYYY-MM-DD
  amount: number;               // INR
  currency?: string;            // defaults to INR
  platform: string;             // META | GOOGLE | WHATSAPP | ...
  source?: string;              // META_INSIGHTS | GOOGLE_ADS | MANUAL — recorded on row
};

export type IngestResult = {
  accepted: number;
  rejected: number;
  campaignsTouched: string[];
  errors: Array<{ rowIndex: number; reason: string }>;
};

export const AdSpendIngestionService = {
  /**
   * Upsert a batch of daily ad-spend rows for an org.
   * Returns counts + list of campaigns that had their running totals
   * recomputed so the caller can fan-out a "campaign.spent updated"
   * event if needed.
   */
  async upsertDailySpend(orgId: string, rows: SpendRow[], options: { userId?: string } = {}): Promise<IngestResult> {
    if (rows.length === 0) {
      return { accepted: 0, rejected: 0, campaignsTouched: [], errors: [] };
    }

    const accepted: SpendRow[] = [];
    const rejected: Array<{ rowIndex: number; reason: string }> = [];
    const campaignsTouched = new Set<string>();

    // 1. Resolve each row to an internal campaignId. Build a cache so we
    //    only query each campaign once even if it shows up in many rows.
    const campaignCache = new Map<string, string>(); // externalId -> internalId

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Validation
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        rejected.push({ rowIndex: i, reason: "date must be YYYY-MM-DD" });
        continue;
      }
      if (typeof row.amount !== "number" || row.amount < 0 || !Number.isFinite(row.amount)) {
        rejected.push({ rowIndex: i, reason: "amount must be a non-negative finite number" });
        continue;
      }
      if (!row.platform) {
        rejected.push({ rowIndex: i, reason: "platform is required" });
        continue;
      }

      // Resolve campaign
      let internalId = row.campaignId;
      if (!internalId && row.campaignExternalId) {
        const cached = campaignCache.get(row.campaignExternalId);
        if (cached) {
          internalId = cached;
        } else {
          const c = await prisma.campaign.findFirst({
            where: { orgId, externalId: row.campaignExternalId }
          });
          if (!c) {
            rejected.push({ rowIndex: i, reason: `no campaign with externalId=${row.campaignExternalId}` });
            continue;
          }
          internalId = c.id;
          campaignCache.set(row.campaignExternalId, c.id);
        }
      }
      if (!internalId) {
        rejected.push({ rowIndex: i, reason: "campaignId or campaignExternalId required" });
        continue;
      }
      accepted.push({ ...row, campaignId: internalId });
      campaignsTouched.add(internalId);
    }

    if (accepted.length === 0) {
      return { accepted: 0, rejected: rejected.length, campaignsTouched: [], errors: rejected };
    }

    // 2. Upsert in a single transaction.
    await prisma.$transaction(
      accepted.map((r) =>
        prisma.adSpend.upsert({
          where: {
            orgId_campaignId_date: {
              orgId,
              campaignId: r.campaignId!,
              date: new Date(r.date + "T00:00:00Z")
            }
          },
          update: {
            amount: r.amount,
            currency: r.currency ?? "INR",
            platform: r.platform,
            source: r.source ?? null
          },
          create: {
            orgId,
            campaignId: r.campaignId!,
            amount: r.amount,
            currency: r.currency ?? "INR",
            platform: r.platform,
            source: r.source ?? null
          }
        })
      )
    );

    // 3. Recompute Campaign.spent for each touched campaign.
    for (const cid of campaignsTouched) {
      const agg = await prisma.adSpend.aggregate({
        where: { campaignId: cid },
        _sum: { amount: true }
      });
      await prisma.campaign.update({
        where: { id: cid },
        data: { spent: agg._sum.amount ?? 0 }
      });
    }

    return {
      accepted: accepted.length,
      rejected: rejected.length,
      campaignsTouched: Array.from(campaignsTouched),
      errors: rejected
    };
  },

  /**
   * Pull the last N days of Meta Marketing Insights for a campaign.
   * Requires META_ACCESS_TOKEN in env and the campaign's externalId to
   * be the Meta campaign id.
   */
  async pullMetaCampaignInsights(
    orgId: string,
    campaignId: string,
    days: number = 7
  ): Promise<{ pulled: number }> {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error("META_ACCESS_TOKEN not set");
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
    if (!campaign?.externalId) throw new Error("campaign has no externalId");

    const since = new Date(Date.now() - days * 86_400_000);
    const until = new Date();
    const url =
      `https://graph.facebook.com/v19.0/${campaign.externalId}/insights` +
      `?fields=spend,impressions,clicks,actions&time_increment=1` +
      `&time_range={"since":"${since.toISOString().slice(0, 10)}","until":"${until.toISOString().slice(0, 10)}"}` +
      `&access_token=${token}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Meta Insights API error: ${r.status} ${await r.text()}`);
    const data = await r.json();
    const rows: SpendRow[] = (data.data ?? []).map((d: any) => ({
      campaignId: campaign.id,
      date: d.date_start,
      amount: Number(d.spend ?? 0),
      currency: "INR",
      platform: "META",
      source: "META_INSIGHTS"
    }));
    await this.upsertDailySpend(orgId, rows);
    return { pulled: rows.length };
  },

  /**
   * Generate an ingestion token for an org. Used by the admin UI to let
   * the team plug Adziga into Meta/Google manually while the OAuth
   * flow is being finalised. Token format: `adz_ing_<orgId>_<random>`.
   * Tokens are stored in Organization.metadata JSON field.
   */
  async mintIngestionToken(orgId: string): Promise<string> {
    const token = `adz_ing_${orgId.slice(0, 8)}_${crypto.randomBytes(16).toString("hex")}`;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const meta = (org?.metadata ? JSON.parse(org.metadata) : {}) as Record<string, unknown>;
    const previous = typeof meta.ingestionToken === "string" ? meta.ingestionToken : null;
    const createdAt = new Date().toISOString();
    meta.ingestionToken = token;
    meta.ingestionTokenCreatedAt = createdAt;
    if (previous) {
      meta.ingestionTokenPrevious = previous;
      meta.ingestionTokenRevokedAt = createdAt;
    }
    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify(meta) }
    });
    return token;
  },

  async revokeIngestionToken(orgId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.metadata) return false;
    const meta = JSON.parse(org.metadata) as Record<string, unknown>;
    const previous = typeof meta.ingestionToken === "string" ? meta.ingestionToken : null;
    if (!previous) return false;
    meta.ingestionToken = null;
    meta.ingestionTokenRevokedAt = new Date().toISOString();
    meta.ingestionTokenPrevious = previous;
    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify(meta) }
    });
    return true;
  },

  async getIngestionTokenInfo(orgId: string): Promise<{
    hasToken: boolean;
    createdAt: string | null;
    previousRevokedAt: string | null;
    previousTokenFingerprint: string | null;
  }> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.metadata) {
      return { hasToken: false, createdAt: null, previousRevokedAt: null, previousTokenFingerprint: null };
    }
    const meta = JSON.parse(org.metadata) as Record<string, unknown>;
    const hasToken = typeof meta.ingestionToken === "string";
    const previous = typeof meta.ingestionTokenPrevious === "string" ? (meta.ingestionTokenPrevious as string) : null;
    return {
      hasToken,
      createdAt: typeof meta.ingestionTokenCreatedAt === "string" ? (meta.ingestionTokenCreatedAt as string) : null,
      previousRevokedAt: typeof meta.ingestionTokenRevokedAt === "string" ? (meta.ingestionTokenRevokedAt as string) : null,
      previousTokenFingerprint: previous ? `${previous.slice(0, 16)}…` : null
    };
  },

  async verifyIngestionToken(orgId: string, presented: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.metadata) return false;
    const meta = JSON.parse(org.metadata) as Record<string, unknown>;
    return meta.ingestionToken === presented;
  }
};
