// Adziga — Budget Optimization (Multi-armed Bandit with Thompson Sampling)
// Each channel is a "bandit arm". Maintains Beta(alpha, beta) posterior over
// expected conversion rate. Sample from posteriors, allocate to highest sample.
// Naturally balances exploration vs exploitation.

import type { Channel, ChannelArm, BudgetOptimizationInput, BudgetOptimizationResult, BudgetAllocation } from "./types";

/**
 * Sample from Beta(alpha, beta) distribution.
 * Uses the property: if X ~ Gamma(alpha, 1) and Y ~ Gamma(beta, 1), then X/(X+Y) ~ Beta(alpha, beta).
 * Marsaglia & Tsang method for Gamma sampling.
 */
function sampleGamma(shape: number, scale: number = 1): number {
  if (shape < 1) {
    // For shape < 1, boost via shape + 1 sampling
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = gaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

function gaussian(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

/**
 * Compute the expected value and 95% credible interval from Beta posterior.
 */
function betaStats(alpha: number, beta: number): { mean: number; lo: number; hi: number } {
  const mean = alpha / (alpha + beta);
  // Variance of Beta
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const std = Math.sqrt(variance);
  return { mean, lo: Math.max(0, mean - 1.96 * std), hi: Math.min(1, mean + 1.96 * std) };
}

/**
 * Run Thompson Sampling for N iterations and report the mean allocation.
 * Each iteration: sample a conversion rate from each arm's posterior, allocate
 * full budget to the highest-sampled arm, observe a Bernoulli, update posteriors.
 * We return the *time-averaged* allocation (probability of being selected),
 * which converges to optimal under standard bandit theory.
 */
export function optimizeBudget(input: BudgetOptimizationInput): BudgetOptimizationResult {
  const explorationRate = input.explorationRate ?? 0.1;
  const arms = input.arms.map((a) => ({
    ...a,
    alpha: Math.max(1, a.successes + 1),
    beta: Math.max(1, a.failures + 1)
  }));

  // If only one arm has data, allocate everything to it
  const activeArms = arms.filter((a) => a.successes + a.failures > 0);
  if (activeArms.length === 0) {
    return {
      totalBudget: input.totalBudget,
      allocations: input.arms.map((a) => ({
        channel: a.channel,
        allocatedBudget: input.totalBudget / input.arms.length,
        expectedConversions: 0,
        confidenceInterval: [0, 0]
      })),
      expectedTotalConversions: 0,
      algorithm: "thompson_sampling",
      generatedAt: new Date().toISOString()
    };
  }

  // Run N Thompson sampling rounds
  const N = 5000;
  const channelAllocationCount = new Map<Channel, number>();
  for (const a of arms) channelAllocationCount.set(a.channel, 0);

  for (let i = 0; i < N; i++) {
    // Sample from each arm's Beta posterior
    let bestArm = arms[0];
    let bestSample = -Infinity;
    for (const arm of arms) {
      let sample = sampleBeta(arm.alpha, arm.beta);
      // Exploration bonus — randomly explore
      if (Math.random() < explorationRate) {
        sample = sample + Math.random() * 0.2;
      }
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }
    channelAllocationCount.set(bestArm.channel, (channelAllocationCount.get(bestArm.channel) ?? 0) + 1);
    // Simulate observation — use empirical ROI as proxy
    const observed = Math.random() < bestArm.alpha / (bestArm.alpha + bestArm.beta) ? 1 : 0;
    if (observed) bestArm.alpha += 1;
    else bestArm.beta += 1;
  }

  // Convert allocation counts to budgets
  const allocations: BudgetAllocation[] = arms.map((arm) => {
    const allocCount = channelAllocationCount.get(arm.channel) ?? 0;
    const allocFraction = allocCount / N;
    const allocatedBudget = input.totalBudget * allocFraction;
    const stats = betaStats(arm.alpha, arm.beta);
    // Expected conversions = (fraction of total conversions attributable to this arm) × total expected conversions
    const totalExpectedConversions = arms.reduce((acc, a) => {
      const s = betaStats(a.alpha, a.beta);
      return acc + (a.spend > 0 ? (a.revenue / a.spend) * a.spend * s.mean : 0);
    }, 0);
    const armExpected = (arm.spend > 0 ? (arm.revenue / arm.spend) * arm.spend * stats.mean : 0);
    return {
      channel: arm.channel,
      allocatedBudget: Math.round(allocatedBudget),
      expectedConversions: Math.round(armExpected * 100) / 100,
      confidenceInterval: [stats.lo, stats.hi]
    };
  });

  return {
    totalBudget: input.totalBudget,
    allocations,
    expectedTotalConversions: Math.round(
      allocations.reduce((a, b) => a + b.expectedConversions, 0) * 100
    ) / 100,
    algorithm: "thompson_sampling",
    generatedAt: new Date().toISOString()
  };
}

/**
 * Update arm posteriors with observed data (online learning).
 * Call this for each new conversion/loss event.
 */
export function updateArm(arm: ChannelArm, observed: 0 | 1): ChannelArm {
  return {
    ...arm,
    successes: arm.successes + (observed === 1 ? 1 : 0),
    failures: arm.failures + (observed === 0 ? 1 : 0)
  };
}
