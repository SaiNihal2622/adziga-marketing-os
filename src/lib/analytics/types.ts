// Adziga — Advanced Analytics
// Shared types for the deep backend intelligence layer.

export type Channel =
  | "META"
  | "GOOGLE"
  | "EMAIL"
  | "WHATSAPP"
  | "ORGANIC"
  | "DIRECT"
  | "REFERRAL"
  | "OTHER";

export const CHANNELS: Channel[] = ["META", "GOOGLE", "EMAIL", "WHATSAPP", "ORGANIC", "DIRECT", "REFERRAL", "OTHER"];

// ─── MMM (Marketing Mix Modeling) ────────────────────────────────────────────
export interface MMMDatapoint {
  date: string; // ISO date
  channel: Channel;
  spend: number; // in INR
}

export interface MMMResultRow {
  channel: Channel;
  coefficient: number; // marginal revenue per ₹1 of spend (elasticity)
  elasticity: number; // % revenue change per 1% spend change
  totalSpend: number;
  attributedRevenue: number;
  roi: number; // revenue / spend
  confidence: number; // 0..1 (R²-like)
}

export interface MMMResult {
  baseline: number;
  totalRevenue: number;
  totalSpend: number;
  overallROI: number;
  rows: MMMResultRow[];
  recommendedReallocation: Array<{ channel: Channel; currentShare: number; recommendedShare: number; reason: string }>;
  trainedAt: string;
}

// ─── Multi-touch Attribution (Shapley values) ────────────────────────────────
export interface Touchpoint {
  channel: Channel;
  campaignId?: string;
  occurredAt: string; // ISO timestamp
}

export interface AttributionInput {
  leadId: string;
  touchpoints: Touchpoint[];
  converted: boolean;
  revenue?: number; // if converted, revenue attributable
}

export interface AttributionResult {
  leadId: string;
  channelCredits: Record<Channel, number>; // fractional credits per channel
  totalCredit: number; // should ≈ 1.0 for converted leads, 0 for non-converted
}

// ─── Predictive Lead Scoring (Logistic regression) ──────────────────────────
export interface LeadFeatures {
  leadId: string;
  source: Channel;
  daysSinceCreated: number;
  emailOpens: number;
  emailClicks: number;
  websiteVisits: number;
  formSubmissions: number;
  hasPhone: 0 | 1;
  hasCompany: 0 | 1;
  cityTier: 0 | 1 | 2; // 0=tier 3, 1=tier 2, 2=tier 1
  previousEngagementScore: number; // 0..100
  recencyDays: number;
  frequency: number;
}

export interface LeadScoreResult {
  leadId: string;
  score: number; // 0..100
  probability: number; // 0..1
  topFactors: Array<{ feature: string; impact: number; direction: "positive" | "negative" }>;
  confidence: number;
}

// ─── Budget Optimization (Multi-armed bandit, Thompson sampling) ────────────
export interface ChannelArm {
  channel: Channel;
  successes: number; // converted leads (alpha in Beta distribution)
  failures: number; // not converted (beta in Beta distribution)
  spend: number;
  revenue: number;
}

export interface BudgetOptimizationInput {
  totalBudget: number; // INR
  arms: ChannelArm[];
  explorationRate?: number; // 0..1, default 0.1
}

export interface BudgetAllocation {
  channel: Channel;
  allocatedBudget: number;
  expectedConversions: number;
  confidenceInterval: [number, number];
}

export interface BudgetOptimizationResult {
  totalBudget: number;
  allocations: BudgetAllocation[];
  expectedTotalConversions: number;
  algorithm: "thompson_sampling";
  generatedAt: string;
}

// ─── Anomaly Detection (Z-score) ────────────────────────────────────────────
export interface MetricDatapoint {
  date: string;
  value: number;
}

export interface AnomalyInput {
  metric: string; // e.g. "spend", "leads", "cpl", "roas"
  series: MetricDatapoint[];
  threshold?: number; // z-score threshold, default 3.0
  direction?: "both" | "above" | "below";
}

export interface Anomaly {
  metric: string;
  date: string;
  observed: number;
  expected: number;
  zScore: number;
  severity: "info" | "warning" | "critical";
  suggestedAction: string;
}

export interface AnomalyResult {
  anomalies: Anomaly[];
  baselineMean: number;
  baselineStdDev: number;
  windowDays: number;
}
