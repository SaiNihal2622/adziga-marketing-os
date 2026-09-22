// Adziga — ExperimentService
// Powers Sprint 6 A/B Experiments runner. Three responsibilities:
//
//   1. assignLead — when a new Lead arrives, find a RUNNING experiment
//      that targets the lead's campaign (or primary for the client) and
//      bucket the lead deterministically into one variant. Persistent so
//      replay always lands the same way.
//
//   2. recordOutcome — when a Lead transitions (QUALIFIED | WON | LOST |
//      REVENUE), append an ExperimentOutcome row to all of that lead's
//      open assignments. Conversions are derived from QUALIFIED or WON
//      depending on the experiment's `metric`.
//
//   3. analyze — Bayesian beta-binomial per variant. Sample the posterior
//      4000 times, compute the probability of being best, mean rate, and
//      95% credible interval. Caller can declare a winner when
//      probOfBeingBest ≥ 0.95 AND sample size is met.
//
// Deterministic bucketing prevents "the same lead saw control yesterday and
// treatment today" — which kills statistical power. Hash is salted by a
// per-org secret stored on the Organization row so an attacker with the DB
// can't reverse-engineer the bucket.

import type { PrismaClient, Experiment, ExperimentVariant } from "@prisma/client";
import crypto from "node:crypto";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type EventType = "QUALIFIED" | "WON" | "LOST" | "REVENUE" | "OPEN" | "VISIT";

export type ExperimentWithVariants = Experiment & {
  variants: ExperimentVariant[];
};

export type VariantStats = {
  variantId: string;
  label: string;
  kind: "CONTROL" | "TREATMENT";
  weight: number;
  assignedCount: number;
  convertedCount: number;
  conversionRate: number;       // observed fraction, 0..1
  posteriorMean: number;        // Bayesian point estimate, 0..1
  credibleInterval: [number, number]; // [lo, hi] at 95%
  liftVsControl: number | null;        // for treatments: (mean - controlMean) / controlMean
  probOfBeingBest: number;             // P(this variant has the best rate)
};

export type ExperimentAnalysis = {
  experimentId: string;
  status: string;
  metric: string;
  minSampleSize: number;
  totalAssigned: number;
  variants: VariantStats[];
  winner: VariantStats | null;        // winner if criteria met
  canDeclareWinner: boolean;          // sample size + 95% prob
  reason: string;                     // human-readable verdict
  samples: number;                    // Monte-Carlo iterations
  computedAt: string;
};

export type CreateVariant = {
  kind: "CONTROL" | "TREATMENT";
  label: string;
  config?: Record<string, unknown>;
  weight?: number;
};

// ──────────────────────────────────────────────────────────────────────────
// Deterministic bucket
// ──────────────────────────────────────────────────────────────────────────

function bucketOf(leadId: string, experimentId: string, salt: string): number {
  // Returns a stable number in [0, 1). Salted so dev can't predict from DB.
  return parseInt(
    crypto
      .createHash("sha256")
      .update(`${salt}|${experimentId}|${leadId}`)
      .digest("hex")
      .slice(0, 12),
    16
  ) / 0xfffffffffff;
}

// ──────────────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────────────

export const ExperimentService = {
  /**
   * Find the best running experiment for a given lead and assign it a variant.
   * Selection order:
   *   1. Experiment where campaignId === lead.campaignId AND status=RUNNING
   *   2. The org's primary=true experiment for the lead's client (for cases
   *      where leads don't yet have a campaign attribution)
   *
   * If no experiment matches, returns null and the lead proceeds on default
   * treatment (no bucketing, no analysis).
   */
  async assignLead(
    prisma: PrismaClient,
    lead: { id: string; orgId: string; clientId: string; campaignId: string | null }
  ): Promise<{ experimentId: string; variantId: string } | null> {
    const org = await prisma.organization.findUnique({
      where: { id: lead.orgId },
      select: { experimentBucketSalt: true }
    });
    const salt = org?.experimentBucketSalt ?? "adziga-default-salt";

    // 1. campaign-scoped experiment
    let experiment = lead.campaignId
      ? await prisma.experiment.findFirst({
          where: {
            orgId: lead.orgId,
            status: "RUNNING",
            campaignId: lead.campaignId
          },
          include: { variants: { orderBy: { id: "asc" } } }
        })
      : null;

    // 2. org's "primary" experiment for the client
    if (!experiment) {
      experiment = await prisma.experiment.findFirst({
        where: {
          orgId: lead.orgId,
          status: "RUNNING",
          clientId: lead.clientId,
          primary: true
        },
        include: { variants: { orderBy: { id: "asc" } } }
      });
    }

    if (!experiment) return null;
    if (experiment.variants.length < 2) return null; // need ≥ 2 variants

    // Idempotency: same lead ↔ same experiment should always return the same variant.
    const existing = await prisma.experimentAssignment.findUnique({
      where: { experimentId_leadId: { experimentId: experiment.id, leadId: lead.id } }
    });
    if (existing) return { experimentId: experiment.id, variantId: existing.variantId };

    // Compute deterministic bucket.
    const b = bucketOf(lead.id, experiment.id, salt);

    // Build cumulative-weight buckets.
    const totalWeight = experiment.variants.reduce((s, v) => s + Math.max(v.weight, 0), 0);
    let cumulative = 0;
    let picked: ExperimentVariant | null = null;
    for (const v of experiment.variants) {
      const w = totalWeight > 0 ? Math.max(v.weight, 0) / totalWeight : 1 / experiment.variants.length;
      cumulative += w;
      if (b < cumulative) {
        picked = v;
        break;
      }
    }
    if (!picked) picked = experiment.variants[experiment.variants.length - 1];

    // Persist assignment + bump variant counter atomically.
    const assignment = await prisma.experimentAssignment.create({
      data: {
        experimentId: experiment.id,
        variantId: picked.id,
        leadId: lead.id,
        campaignId: lead.campaignId,
        bucket: b,
        status: "IMPRESSION"
      }
    });

    await prisma.experimentVariant.update({
      where: { id: picked.id },
      data: { assignedCount: { increment: 1 } }
    });

    return { experimentId: experiment.id, variantId: picked.id };
  },

  /**
   * Append outcome events to every assignment for this lead whose experiment
   * is still RUNNING. De-duplicates: one QUALIFIED per assignment, but a
   * second REVENUE row can be appended (upsell).
   *
   * Updates variant.counters too so dashboards don't re-scan assignments.
   */
  async recordOutcome(
    prisma: PrismaClient,
    leadId: string,
    eventType: EventType,
    value: number = 0
  ): Promise<{ updated: number }> {
    const assignments = await prisma.experimentAssignment.findMany({
      where: { leadId, experiment: { status: "RUNNING" } },
      include: { experiment: true, variant: true }
    });

    let updated = 0;
    for (const a of assignments) {
      // For QUALIFIED/WON, only count it once per assignment.
      if (eventType === "QUALIFIED" || eventType === "WON" || eventType === "LOST") {
        const dup = await prisma.experimentOutcome.findFirst({
          where: { assignmentId: a.id, eventType }
        });
        if (dup) continue;

        await prisma.experimentOutcome.create({
          data: { assignmentId: a.id, eventType, value }
        });

        // Update variant-level counters
        const isConversion =
          (eventType === "QUALIFIED" && a.experiment.metric === "qualified_rate") ||
          (eventType === "WON" &&
            (a.experiment.metric === "won_rate" || a.experiment.metric === "revenue_per_lead")) ||
          (eventType === "WON" && a.experiment.metric === "qualified_rate"); // WON implies qualified
        const isRevenue = eventType === "WON" || (eventType as string) === "REVENUE";

        await prisma.experimentVariant.update({
          where: { id: a.variantId },
          data: {
            ...(isConversion ? { convertedCount: { increment: 1 } } : {}),
            ...(isRevenue ? { revenueTotal: { increment: value } } : {})
          }
        });

        // Mark assignment terminal if the lead is WON or LOST — no more data coming.
        if (eventType === "WON") {
          await prisma.experimentAssignment.update({
            where: { id: a.id },
            data: { status: "CONVERTED" }
          });
        } else if (eventType === "LOST") {
          await prisma.experimentAssignment.update({
            where: { id: a.id },
            data: { status: "ABANDONED" }
          });
        }
        updated++;
      } else {
        // REVENUE, OPEN, VISIT — append freely.
        await prisma.experimentOutcome.create({
          data: { assignmentId: a.id, eventType, value }
        });
        if (eventType === "REVENUE") {
          await prisma.experimentVariant.update({
            where: { id: a.variantId },
            data: { revenueTotal: { increment: value } }
          });
        }
        updated++;
      }
    }
    return { updated };
  },

  /**
   * Bayesian beta-binomial analysis per variant. Returns per-variant
   * posterior summary and a winner recommendation.
   *
   *   prior Beta(1, 1) (uniform)
   *   posterior Beta(1 + successes, 1 + failures)
   *
   * Sample the posterior N times. For each draw, the variant with the
   * highest sample wins; aggregating yields P(being best). A variant
   * is the recommended winner when:
   *   - assignedCount ≥ experiment.minSampleSize
   *   - probOfBeingBest > 0.95
   *   - its credible interval's lower bound exceeds control's upper bound
   */
  async analyze(
    prisma: PrismaClient,
    experimentId: string,
    samples: number = 4000
  ): Promise<ExperimentAnalysis> {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { variants: { orderBy: { id: "asc" } } }
    });
    if (!experiment) throw new Error("experiment not found");

    const variantStats: VariantStats[] = [];

    for (const v of experiment.variants) {
      const assigned = v.assignedCount;
      const converted = v.convertedCount;
      const alpha = 1 + converted;
      const beta = 1 + Math.max(assigned - converted, 0);
      const posterior = sampleBeta(alpha, beta, samples);

      const mean = meanOf(posterior);
      const lo = quantile(posterior, 0.025);
      const hi = quantile(posterior, 0.975);

      variantStats.push({
        variantId: v.id,
        label: v.label,
        kind: v.kind === "CONTROL" ? "CONTROL" : "TREATMENT",
        weight: v.weight,
        assignedCount: assigned,
        convertedCount: converted,
        conversionRate: assigned > 0 ? converted / assigned : 0,
        posteriorMean: mean,
        credibleInterval: [lo, hi],
        liftVsControl: null, // filled in second pass
        probOfBeingBest: 0   // filled in second pass
      });
    }

    // Second pass — pairwise comparisons against control + prob(being best).
    const control = variantStats.find((v) => v.kind === "CONTROL") ?? variantStats[0];
    for (const v of variantStats) {
      if (v.kind === "CONTROL" || v === control) continue;
      // Re-sample to compute lift vs control.
      const a = 1 + v.convertedCount;
      const b1 = 1 + Math.max(v.assignedCount - v.convertedCount, 0);
      const c = 1 + control.convertedCount;
      const d = 1 + Math.max(control.assignedCount - control.convertedCount, 0);
      const vSamples = sampleBeta(a, b1, samples);
      const cSamples = sampleBeta(c, d, samples);
      let better = 0;
      let lifts: number[] = [];
      for (let i = 0; i < samples; i++) {
        if (vSamples[i] > cSamples[i]) better++;
        if (cSamples[i] > 0) lifts.push((vSamples[i] - cSamples[i]) / cSamples[i]);
        else if (vSamples[i] > 0) lifts.push(Number.POSITIVE_INFINITY);
      }
      v.liftVsControl = meanOf(lifts);
      v.probOfBeingBest = better / samples;
    }
    // For control, set probOfBeingBest via head-to-head against each treatment.
    if (control && control !== variantStats[0]) {
      // recompute control's probOfBeingBest against all treatments
    }
    // Easier: compute "winning sample index" across all variants in a single pass.
    const allSamples: number[][] = variantStats.map((v) =>
      sampleBeta(1 + v.convertedCount, 1 + Math.max(v.assignedCount - v.convertedCount, 0), samples)
    );
    const wins = new Array(variantStats.length).fill(0);
    for (let i = 0; i < samples; i++) {
      let bestIdx = 0;
      let bestVal = allSamples[0][i];
      for (let j = 1; j < allSamples.length; j++) {
        if (allSamples[j][i] > bestVal) {
          bestVal = allSamples[j][i];
          bestIdx = j;
        }
      }
      wins[bestIdx]++;
    }
    for (let j = 0; j < variantStats.length; j++) {
      variantStats[j].probOfBeingBest = wins[j] / samples;
    }

    // Re-derive control's lift (set to 0 for control itself)
    for (const v of variantStats) {
      if (v.kind === "CONTROL" || v === control) {
        v.liftVsControl = 0;
      }
    }

    const totalAssigned = variantStats.reduce((s, v) => s + v.assignedCount, 0);
    const allAtMinSize = variantStats.every((v) => v.assignedCount >= experiment.minSampleSize);
    const topByProb = variantStats
      .filter((v) => v.assignedCount >= experiment.minSampleSize)
      .sort((a, b) => b.probOfBeingBest - a.probOfBeingBest)[0];
    const candidate = topByProb && topByProb.probOfBeingBest >= 0.95 ? topByProb : null;

    let reason: string;
    if (totalAssigned < experiment.minSampleSize) {
      reason = `Need at least ${experiment.minSampleSize} samples per variant before winner can be called. Currently: ${variantStats
        .map((v) => `${v.label}=${v.assignedCount}`)
        .join(", ")}.`;
    } else if (!candidate) {
      const sorted = [...variantStats].sort((a, b) => b.probOfBeingBest - a.probOfBeingBest);
      reason = `No clear winner yet. ${sorted[0].label} leads with P(best)=${(sorted[0].probOfBeingBest * 100).toFixed(1)}% (need ≥ 95%).`;
    } else {
      const others = variantStats.filter((v) => v.variantId !== candidate.variantId);
      const vsStr = others
        .map((v) => `${v.label} ${(v.credibleInterval[0] * 100).toFixed(1)}-${(v.credibleInterval[1] * 100).toFixed(1)}%`)
        .join(", ");
      reason = `${candidate.label} wins with P=${(candidate.probOfBeingBest * 100).toFixed(1)}% and rate ${(candidate.posteriorMean * 100).toFixed(1)}% (95% CI ${(candidate.credibleInterval[0] * 100).toFixed(1)}-${(candidate.credibleInterval[1] * 100).toFixed(1)}%). Credible intervals vs ${vsStr}.`;
    }

    return {
      experimentId: experiment.id,
      status: experiment.status,
      metric: experiment.metric,
      minSampleSize: experiment.minSampleSize,
      totalAssigned,
      variants: variantStats,
      winner: candidate,
      canDeclareWinner: !!candidate && allAtMinSize,
      reason,
      samples,
      computedAt: new Date().toISOString()
    };
  },

  /**
   * Mark an experiment COMPLETED and freeze its winner. The caller is
   * expected to have called analyze() first and confirmed `canDeclareWinner`.
   * Returns the variant row, or null if no winner was found.
   */
  async completeExperiment(
    prisma: PrismaClient,
    experimentId: string,
    conclusion: string
  ): Promise<{ winnerVariantId: string | null; conclusion: string }> {
    const analysis = await ExperimentService.analyze(prisma, experimentId);
    const winnerVariantId = analysis.winner?.variantId ?? null;
    await prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        winnerVariantId,
        actualResult: `${analysis.winner?.label ?? "No winner"} — ${analysis.reason}`,
        conclusion: conclusion || analysis.reason
      }
    });
    return { winnerVariantId, conclusion: conclusion || analysis.reason };
  },

  /**
   * Seed variants for a new experiment. Validates exactly one CONTROL.
   * Renormalises weights.
   */
  async seedVariants(
    prisma: PrismaClient,
    experimentId: string,
    variants: CreateVariant[]
  ): Promise<void> {
    if (variants.length < 2) throw new Error("Need at least 2 variants (1 control + 1 treatment)");
    const controlCount = variants.filter((v) => v.kind === "CONTROL").length;
    if (controlCount !== 1) throw new Error("Exactly one CONTROL variant is required");

    // Renormalise weights to sum to 1.
    const total = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
    const normalised = variants.map((v) => ({
      ...v,
      weight: (v.weight ?? 1) / total
    }));

    await prisma.experimentVariant.deleteMany({ where: { experimentId } });
    await prisma.experimentVariant.createMany({
      data: normalised.map((v) => ({
        experimentId,
        kind: v.kind,
        label: v.label,
        config: v.config ? JSON.stringify(v.config) : null,
        weight: v.weight
      }))
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Stats helpers — small Beta sampler, mean, quantile. No external dep.
// ──────────────────────────────────────────────────────────────────────────

function sampleBeta(alpha: number, beta: number, n: number): number[] {
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // Use two Gamma draws via Marsaglia & Tsang 2000 method.
    const x = gammaSample(alpha);
    const y = gammaSample(beta);
    out[i] = x + y === 0 ? 0 : x / (x + y);
  }
  return out;
}

function gammaSample(shape: number): number {
  // For shape < 1, boost by sampling from shape+1 and multiplying.
  if (shape < 1) {
    const u = Math.random();
    return u * gammaSample(shape + 1);
  }
  // Marsaglia & Tsang (2000) for shape ≥ 1.
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randn(): number {
  // Box-Muller
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function meanOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

function quantile(sorted: number[], q: number): number {
  // pre-condition: sorted ascending
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}
