// Adziga — AutoPausePolicyService (Sprint 17b)
// Closes the loop on anomaly → approval: if a campaign has been
// flagged as "pause" by the anomaly detector for N consecutive days
// AND it's not on a whitelist AND the global auto-pause policy has
// `enabled=true`, this service flips Campaign.status from ACTIVE to
// PAUSED and writes an audit log entry.
//
// Defaults are conservative:
//   - enabled: false (manual only)
//   - dryRun: true  (report-only by default — `evaluate` returns what
//                    it WOULD do without mutating)
//   - consecutiveAnomalyDays: 3
//   - whitelistClientIds / whitelistPlatforms: empty
//
// Policy is persisted in Organization.metadata.autoPausePolicy.

import { prisma } from "@/lib/db";
import { CampaignAnomalyService } from "./campaign-anomaly-service";

export type AutoPausePolicy = {
  enabled: boolean;
  dryRun: boolean;
  consecutiveAnomalyDays: number; // default 3
  whitelistClientIds: string[];
  whitelistPlatforms: string[];
  // Cap: never pause more than this many campaigns in a single run.
  maxPerRun: number;
};

export const DEFAULT_POLICY: AutoPausePolicy = {
  enabled: false,
  dryRun: true,
  consecutiveAnomalyDays: 3,
  whitelistClientIds: [],
  whitelistPlatforms: [],
  maxPerRun: 5
};

export type PauseCandidate = {
  campaignId: string;
  campaignName: string;
  platform: string;
  clientId: string | null;
  clientName: string | null;
  reason: string;
  observations: number;       // how many of the last N anomaly evaluations flagged it
  consecutiveStreak: number;  // longest recent streak
  skipped: boolean;           // true if policy skipped (e.g. whitelisted)
  skipReason?: string;
  paused: boolean;            // true if status was actually flipped
};

export type EvaluateResult = {
  dryRun: boolean;
  policy: AutoPausePolicy;
  candidates: PauseCandidate[];
  total: { evaluated: number; paused: number; skipped: number };
  evaluatedAt: string;
};

const POLICY_KEY = "autoPausePolicy";

function safeJsonParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function loadPolicy(orgId: string): Promise<AutoPausePolicy> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  const p = (meta[POLICY_KEY] ?? {}) as Partial<AutoPausePolicy>;
  return {
    ...DEFAULT_POLICY,
    ...p
  };
}

export const AutoPausePolicyService = {
  /**
   * Read the current policy (with defaults applied).
   */
  async getPolicy(orgId: string): Promise<AutoPausePolicy> {
    return loadPolicy(orgId);
  },

  /**
   * Update the policy. Returns the merged policy.
   */
  async updatePolicy(
    orgId: string,
    patch: Partial<AutoPausePolicy>
  ): Promise<AutoPausePolicy> {
    const current = await loadPolicy(orgId);
    const merged: AutoPausePolicy = {
      ...current,
      ...patch,
      whitelistClientIds: patch.whitelistClientIds ?? current.whitelistClientIds,
      whitelistPlatforms: patch.whitelistPlatforms ?? current.whitelistPlatforms
    };
    // Safety: enforce bounds on tunable numbers.
    merged.consecutiveAnomalyDays = Math.max(1, Math.min(14, Math.round(merged.consecutiveAnomalyDays)));
    merged.maxPerRun = Math.max(0, Math.min(100, Math.round(merged.maxPerRun)));

    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metadata: true }
    });
    const meta = safeJsonParse(row?.metadata);
    await prisma.organization.update({
      where: { id: orgId },
      data: { metadata: JSON.stringify({ ...meta, [POLICY_KEY]: merged }) }
    });
    return merged;
  },

  /**
   * Run the auto-pause evaluation. With dryRun=true (default), returns
   * the candidates WITHOUT flipping any status. With dryRun=false, mutates
   * the database (status: ACTIVE → PAUSED) up to `maxPerRun` candidates.
   *
   * Streak detection: re-runs CampaignAnomalyService.detectForOrg with
   * windowDays=7, 14, 21 to count how many "pause" recommendations the
   * campaign has received in the last N evaluations. Simpler than
   * tracking historical Approval rows.
   */
  async evaluate(orgId: string, requestedById: string = "system:autopause"): Promise<EvaluateResult> {
    const policy = await loadPolicy(orgId);

    // Pull anomaly snapshots at 7, 14, 21 days back. A pause-flagged
    // campaign in all three = "consistent".
    const [snap7, snap14, snap21] = await Promise.all([
      CampaignAnomalyService.detectForOrg(orgId, 7),
      CampaignAnomalyService.detectForOrg(orgId, 14),
      CampaignAnomalyService.detectForOrg(orgId, 21)
    ]);

    const pauseSet = (snap: typeof snap7) =>
      new Set(snap.filter((a) => a.recommendAction === "pause").map((a) => a.campaignId));

    const set7 = pauseSet(snap7);
    const set14 = pauseSet(snap14);
    const set21 = pauseSet(snap21);

    // Only consider ACTIVE campaigns currently.
    const candidates = await prisma.campaign.findMany({
      where: { orgId, status: "ACTIVE" },
      include: { client: { select: { id: true, businessName: true } } }
    });

    const enriched: PauseCandidate[] = candidates
      .filter((c) => set7.has(c.id))
      .map((c) => {
        const in7 = set7.has(c.id);
        const in14 = set14.has(c.id);
        const in21 = set21.has(c.id);
        const streak = (in21 ? 1 : 0) + (in14 ? 1 : 0) + (in7 ? 1 : 0);
        const latest = snap7.find((s) => s.campaignId === c.id);
        return {
          campaignId: c.id,
          campaignName: c.name,
          platform: c.platform,
          clientId: c.clientId,
          clientName: c.client?.businessName ?? null,
          reason: latest?.reason ?? "Anomaly detector flagged for pause",
          observations: [in21, in14, in7].filter(Boolean).length,
          consecutiveStreak: streak,
          skipped: false,
          paused: false
        };
      })
      // Only keep campaigns that have been persistently flagged.
      .filter((c) => c.observations >= Math.max(1, policy.consecutiveAnomalyDays))
      .map((c) => {
        let skipReason: string | undefined;
        let skipped = false;
        if (policy.whitelistClientIds.includes(c.clientId ?? "")) {
          skipped = true;
          skipReason = `Client "${c.clientName}" is whitelisted`;
        } else if (policy.whitelistPlatforms.includes(c.platform)) {
          skipped = true;
          skipReason = `Platform "${c.platform}" is whitelisted`;
        }
        return { ...c, skipped, skipReason };
      });

    // Enforce maxPerRun cap (only relevant if not dryRun).
    const isDry = policy.dryRun || !policy.enabled;
    const actionable = enriched.filter((c) => !c.skipped).slice(0, policy.maxPerRun);

    if (!isDry) {
      for (const cand of actionable) {
        await prisma.campaign.update({
          where: { id: cand.campaignId },
          data: { status: "PAUSED" }
        });
        await prisma.auditLog.create({
          data: {
            orgId,
            userId: requestedById,
            action: "campaign.auto_paused",
            entityType: "Campaign",
            entityId: cand.campaignId,
            after: JSON.stringify({
              status: "PAUSED",
              trigger: "auto_pause_policy",
              reason: cand.reason,
              observations: cand.observations
            })
          }
        });
        cand.paused = true;
      }
    }

    return {
      dryRun: isDry,
      policy,
      candidates: enriched,
      total: {
        evaluated: enriched.length,
        paused: enriched.filter((c) => c.paused).length,
        skipped: enriched.filter((c) => c.skipped).length
      },
      evaluatedAt: new Date().toISOString()
    };
  }
};
