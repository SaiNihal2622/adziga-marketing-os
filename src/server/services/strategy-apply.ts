// Adziga — StrategyAutoApply (Sprint 18b)
// Closes the loop from the Strategy Agent: when an admin clicks
// "Approve + materialize" on a StrategyRecommendation, this service
// creates one Campaign row per recommended channel (with budget
// allocated by allocationPct) in status=INTERNAL_REVIEW (kept safe —
// still requires the normal status-flow before going live).
//
// Idempotent: the same recommendation cannot be materialized twice
// (we set status=APPLIED and check it before mutating).

import { prisma } from "@/lib/db";

export type MaterializeResult = {
  recommendationId: string;
  status: "APPLIED" | "ALREADY_APPLIED" | "MISSING_CLIENT";
  createdCampaigns: Array<{
    id: string;
    name: string;
    platform: string;
    budget: number;
  }>;
};

type RawChannel = {
  platform?: string;
  allocationPct?: number;
  expectedCpl?: number;
  [k: string]: unknown;
};

const VALID_PLATFORMS = new Set([
  "META",
  "GOOGLE",
  "YOUTUBE",
  "INSTAGRAM",
  "WHATSAPP",
  "LINKEDIN",
  "TWITTER",
  "EMAIL",
  "INFLUENCER",
  "EVENT"
]);

function safeJsonParse<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export const StrategyAutoApply = {
  /**
   * Materialize an approved StrategyRecommendation into Campaign rows.
   *
   *   - requires StrategyRecommendation.status="PROPOSED"
   *   - sets it to "APPLIED" on success
   *   - returns the newly created Campaign rows
   *
   * Conservative defaults:
   *   • status = INTERNAL_REVIEW (not READY/ACTIVE) so the existing
   *     workflow gate still applies.
   *   • startDate null, endDate null — admin fills them in.
   */
  async materialize(orgId: string, recommendationId: string, acceptedById: string): Promise<MaterializeResult> {
    const rec = await prisma.strategyRecommendation.findFirst({
      where: { id: recommendationId, orgId }
    });
    if (!rec) {
      throw new Error("Strategy recommendation not found");
    }
    if (rec.status === "APPLIED") {
      const existing = await prisma.campaign.findMany({
        where: { orgId, notes: { startsWith: `strategy:${rec.id}:` } },
        select: { id: true, name: true, platform: true, budget: true }
      });
      return {
        recommendationId: rec.id,
        status: "ALREADY_APPLIED",
        createdCampaigns: existing.map((c) => ({
          id: c.id,
          name: c.name,
          platform: c.platform,
          budget: c.budget ?? 0
        }))
      };
    }
    if (!rec.clientId) {
      return { recommendationId: rec.id, status: "MISSING_CLIENT", createdCampaigns: [] };
    }

    const channelsRaw = safeJsonParse<RawChannel[]>(rec.recommendedChannels) ?? [];
    const validChannels = channelsRaw.filter(
      (c) => c.platform && VALID_PLATFORMS.has(c.platform) && typeof c.allocationPct === "number"
    );
    if (validChannels.length === 0) {
      throw new Error("No valid channels in recommendation");
    }

    // Look up the client for a usable name prefix.
    const client = await prisma.client.findUnique({
      where: { id: rec.clientId },
      select: { businessName: true }
    });

    const created: MaterializeResult["createdCampaigns"] = [];
    for (const ch of validChannels) {
      const allocation = (ch.allocationPct ?? 0) / 100;
      const budget = Math.max(0, Math.round(rec.monthlyBudget * allocation));
      const name = `${client?.businessName ?? "Client"} — ${ch.platform} (from strategy ${rec.id.slice(-6)})`;

      const c = await prisma.campaign.create({
        data: {
          orgId,
          clientId: rec.clientId,
          name,
          platform: ch.platform!,
          objective: rec.objective,
          budget,
          status: "INTERNAL_REVIEW",
          notes: `strategy:${rec.id}: auto-created from StrategyRecommendation`
        }
      });
      created.push({ id: c.id, name: c.name, platform: c.platform, budget });
    }

    await prisma.strategyRecommendation.update({
      where: { id: rec.id },
      data: { status: "APPLIED", acceptedAt: new Date(), acceptedById }
    });

    await prisma.auditLog.create({
      data: {
        orgId,
        userId: acceptedById,
        action: "strategy.materialize",
        entityType: "StrategyRecommendation",
        entityId: rec.id,
        after: JSON.stringify({
          createdCount: created.length,
          campaignIds: created.map((c) => c.id)
        })
      }
    });

    return { recommendationId: rec.id, status: "APPLIED", createdCampaigns: created };
  }
};
