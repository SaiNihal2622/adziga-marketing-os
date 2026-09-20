// Adziga — Anomaly Detection (Z-score with rolling baseline)
// For each metric, compare current value against a rolling baseline (mean ± stddev).
// Values beyond threshold (default ±3σ) are flagged as anomalies with severity.

import type { AnomalyInput, Anomaly, AnomalyResult, MetricDatapoint } from "./types";

/**
 * Compute mean and sample standard deviation.
 */
function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return { mean, std: 0 };
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Detect anomalies using a rolling baseline window.
 * The baseline is computed from the first (windowDays) of the series,
 * the latest points are tested against that baseline.
 */
export function detectAnomalies(input: AnomalyInput): AnomalyResult {
  const threshold = input.threshold ?? 3.0;
  const direction = input.direction ?? "both";
  const windowDays = Math.min(30, Math.max(7, Math.floor(input.series.length / 2)));

  // Split into baseline (older) and recent (newer)
  const sorted = [...input.series].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < windowDays + 1) {
    return {
      anomalies: [],
      baselineMean: 0,
      baselineStdDev: 0,
      windowDays
    };
  }
  const baselinePoints = sorted.slice(0, sorted.length - windowDays);
  const recentPoints = sorted.slice(-windowDays);

  const baselineValues = baselinePoints.map((p) => p.value);
  const { mean, std } = meanStd(baselineValues);

  const anomalies: Anomaly[] = [];
  for (const point of recentPoints) {
    if (std === 0) continue;
    const z = (point.value - mean) / std;
    const absZ = Math.abs(z);

    if (absZ < threshold) continue;
    if (direction === "above" && z < 0) continue;
    if (direction === "below" && z > 0) continue;

    let severity: "info" | "warning" | "critical" = "info";
    if (absZ >= threshold * 2) severity = "critical";
    else if (absZ >= threshold * 1.5) severity = "warning";

    const direction_label = z > 0 ? "spike" : "drop";
    const suggestedAction = suggestAction(input.metric, z, mean, point.value);

    anomalies.push({
      metric: input.metric,
      date: point.date,
      observed: point.value,
      expected: mean,
      zScore: Math.round(z * 100) / 100,
      severity,
      suggestedAction
    });
  }

  return {
    anomalies,
    baselineMean: mean,
    baselineStdDev: std,
    windowDays
  };
}

/**
 * Domain-specific action suggestions based on metric type.
 */
function suggestAction(metric: string, z: number, baseline: number, observed: number): string {
  const isSpike = z > 0;
  const change = ((observed - baseline) / Math.max(1, baseline)) * 100;

  if (metric === "spend") {
    return isSpike
      ? `Spend spiked ${change.toFixed(0)}% above baseline. Verify campaign budgets and pacing — could indicate budget cap reached or runaway spend.`
      : `Spend dropped ${Math.abs(change).toFixed(0)}% below baseline. Check if campaigns paused, ads rejected, or billing failed.`;
  }
  if (metric === "leads") {
    return isSpike
      ? `Lead volume spiked ${change.toFixed(0)}% above baseline. Verify lead quality before scaling — could indicate bot traffic or form misconfiguration.`
      : `Lead volume dropped ${Math.abs(change).toFixed(0)}% below baseline. Investigate channel issues, ad rejection, or landing-page outages.`;
  }
  if (metric === "cpl") {
    return isSpike
      ? `CPL spiked ${change.toFixed(0)}% above baseline. Pause underperforming creatives, refresh audiences, or adjust bids.`
      : `CPL dropped ${Math.abs(change).toFixed(0)}% below baseline — efficient period. Consider scaling budget to capture.`;
  }
  if (metric === "roas") {
    return isSpike
      ? `ROAS jumped ${change.toFixed(0)}% above baseline. Strong performance window — scale winners, lock in creative.`
      : `ROAS dropped ${Math.abs(change).toFixed(0)}% below baseline. Refresh creatives, audit conversion tracking, check attribution.`;
  }
  if (metric === "ctr") {
    return isSpike
      ? `CTR improved ${change.toFixed(0)}% above baseline. New creative winning — consider scaling.`
      : `CTR dropped ${Math.abs(change).toFixed(0)}% below baseline. Creative fatigue or audience saturation likely.`;
  }
  return isSpike
    ? `${metric} spiked ${change.toFixed(0)}% above baseline. Investigate cause.`
    : `${metric} dropped ${Math.abs(change).toFixed(0)}% below baseline. Investigate cause.`;
}

/**
 * Detect anomalies across all standard marketing metrics.
 * Convenience function — runs detectAnomalies on each metric.
 */
export function detectAllAnomalies(
  seriesByMetric: Record<string, MetricDatapoint[]>,
  options?: { threshold?: number; windowDays?: number }
): Record<string, AnomalyResult> {
  const result: Record<string, AnomalyResult> = {};
  for (const [metric, series] of Object.entries(seriesByMetric)) {
    if (series.length === 0) continue;
    result[metric] = detectAnomalies({
      metric,
      series,
      threshold: options?.threshold ?? 3.0
    });
  }
  return result;
}
