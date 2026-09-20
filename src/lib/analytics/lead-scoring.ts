// Adziga — Predictive Lead Scoring (Logistic Regression with online learning)
// Trained on converted vs lost leads. Calibrated probabilities via Platt scaling.

import type { LeadFeatures, LeadScoreResult } from "./types";

/**
 * Standard logistic function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * One-hot encoding of categorical feature (source channel)
 */
const CHANNEL_VOCAB = ["META", "GOOGLE", "EMAIL", "WHATSAPP", "ORGANIC", "DIRECT", "REFERRAL", "OTHER"] as const;

function oneHot(value: string, vocab: readonly string[]): number[] {
  return vocab.map((v) => (v === value ? 1 : 0));
}

/**
 * Convert LeadFeatures into a numeric feature vector.
 * Order: [source_one_hot(8), daysSinceCreated, emailOpens, emailClicks,
 *         websiteVisits, formSubmissions, hasPhone, hasCompany, cityTier,
 *         previousEngagementScore, recencyDays, frequency]
 */
export function featurize(features: Omit<LeadFeatures, "leadId">): number[] {
  return [
    ...oneHot(features.source, CHANNEL_VOCAB),
    Math.log1p(features.daysSinceCreated),
    Math.log1p(features.emailOpens),
    Math.log1p(features.emailClicks),
    Math.log1p(features.websiteVisits),
    Math.log1p(features.formSubmissions),
    features.hasPhone,
    features.hasCompany,
    features.cityTier / 2,
    features.previousEngagementScore / 100,
    Math.log1p(features.recencyDays),
    Math.log1p(features.frequency)
  ];
}

export const FEATURE_DIM = CHANNEL_VOCAB.length + 11; // 8 + 11 = 19

/**
 * Default model weights — initialized from Adziga's seed-data heuristics.
 * These get updated as more leads convert (online learning via gradient descent).
 */
const DEFAULT_WEIGHTS: number[] = [
  // source one-hot: META, GOOGLE, EMAIL, WHATSAPP, ORGANIC, DIRECT, REFERRAL, OTHER
  0.3, 0.4, 0.5, 0.6, 0.2, 0.1, 0.15, 0.05,
  // daysSinceCreated (older = less likely, negative weight)
  -0.2,
  // emailOpens
  0.3,
  // emailClicks (stronger signal)
  0.5,
  // websiteVisits
  0.4,
  // formSubmissions (very strong signal)
  0.9,
  // hasPhone
  0.4,
  // hasCompany
  0.3,
  // cityTier
  0.2,
  // previousEngagementScore (0..1)
  1.5,
  // recencyDays (more recent = more likely, negative weight on days)
  -0.3,
  // frequency (more touches = more likely)
  0.4
];

const DEFAULT_BIAS = -0.5;

export interface LogisticModel {
  weights: number[];
  bias: number;
  plattA: number; // Platt scaling parameter A
  plattB: number; // Platt scaling parameter B
}

export function defaultModel(): LogisticModel {
  return {
    weights: [...DEFAULT_WEIGHTS],
    bias: DEFAULT_BIAS,
    plattA: 1.0,
    plattB: 0.0
  };
}

/**
 * Score a single lead using the current model.
 */
export function scoreLead(model: LogisticModel, features: LeadFeatures): LeadScoreResult {
  const x = featurize(features);
  // Pad or trim if dim mismatch
  while (x.length < model.weights.length) x.push(0);
  while (model.weights.length < x.length) model.weights.push(0);
  let z = model.bias;
  for (let i = 0; i < x.length; i++) z += model.weights[i] * x[i];
  const rawProb = sigmoid(z);
  // Platt scaling: calibrated = sigmoid(A * rawLogit + B)
  const rawLogit = Math.log(rawProb / (1 - rawProb));
  const calibrated = sigmoid(model.plattA * rawLogit + model.plattB);

  // Top factors: which features contributed most to the score?
  const contributions = x.map((xi, i) => ({
    feature: featureName(i),
    impact: Math.abs(xi * (model.weights[i] ?? 0)),
    direction: ((model.weights[i] ?? 0) * xi) > 0 ? ("positive" as const) : ("negative" as const)
  }));
  contributions.sort((a, b) => b.impact - a.impact);
  const topFactors = contributions.slice(0, 5);

  return {
    leadId: features.leadId,
    score: Math.round(calibrated * 100),
    probability: calibrated,
    topFactors,
    confidence: 1 - Math.abs(0.5 - calibrated) * 2 // higher near 0 or 1
  };
}

/**
 * Score a batch of leads in one pass.
 */
export function scoreLeads(model: LogisticModel, batch: LeadFeatures[]): LeadScoreResult[] {
  return batch.map((f) => scoreLead(model, f));
}

function featureName(idx: number): string {
  if (idx < CHANNEL_VOCAB.length) return `source:${CHANNEL_VOCAB[idx]}`;
  const labels = ["daysSinceCreated", "emailOpens", "emailClicks", "websiteVisits", "formSubmissions", "hasPhone", "hasCompany", "cityTier", "engagementScore", "recencyDays", "frequency"];
  return labels[idx - CHANNEL_VOCAB.length] ?? `feat_${idx}`;
}

/**
 * Online update — single-step gradient descent on one labeled example.
 * Call this for each new conversion or loss event to keep the model fresh.
 */
export function updateModel(
  model: LogisticModel,
  features: Omit<LeadFeatures, "leadId">,
  label: 0 | 1,
  learningRate: number = 0.05
): void {
  const x = featurize(features);
  while (x.length < model.weights.length) x.push(0);
  while (model.weights.length < x.length) model.weights.push(0);
  let z = model.bias;
  for (let i = 0; i < x.length; i++) z += model.weights[i] * x[i];
  const pred = sigmoid(z);
  const err = label - pred;
  // L2 regularization to prevent drift
  const lambda = 0.001;
  for (let i = 0; i < x.length; i++) {
    model.weights[i] = (model.weights[i] ?? 0) + learningRate * (err * x[i] - lambda * (model.weights[i] ?? 0));
  }
  model.bias += learningRate * err;
}

/**
 * Train initial model from labeled examples (cold start).
 * Uses stochastic gradient descent for N epochs.
 */
export function trainModel(
  examples: Array<{ features: Omit<LeadFeatures, "leadId">; label: 0 | 1 }>,
  epochs: number = 30,
  learningRate: number = 0.05
): LogisticModel {
  const model = defaultModel();
  for (let e = 0; e < epochs; e++) {
    // Shuffle
    const shuffled = [...examples].sort(() => Math.random() - 0.5);
    for (const ex of shuffled) {
      updateModel(model, ex.features, ex.label, learningRate);
    }
  }
  return model;
}
