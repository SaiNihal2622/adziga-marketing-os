// Adziga — Marketing Mix Modeling (MMM)
// Bayesian-style linear regression attributing revenue/conversions to channel spend.
// Uses adstock transformation for time-decay effects and returns elasticity per channel.

import type { Channel, MMMDatapoint, MMMResult, MMMResultRow } from "./types";

/**
 * Adstock transformation — exponential decay of past spend effects.
 * Models the fact that today's spend drives not just today's conversions
 * but a decaying tail of future conversions.
 */
export function adstock(spendSeries: number[], retentionRate: number = 0.5, maxLag: number = 7): number[] {
  const out: number[] = [];
  for (let i = 0; i < spendSeries.length; i++) {
    let weighted = spendSeries[i];
    for (let lag = 1; lag <= maxLag && i - lag >= 0; lag++) {
      weighted += spendSeries[i - lag] * Math.pow(retentionRate, lag);
    }
    out.push(weighted);
  }
  return out;
}

/**
 * Group daily channel spend into per-day totals across channels.
 * Returns { date: { channel: spend, ... }, ... }
 */
function pivotByDate(rows: MMMDatapoint[]): Map<string, Record<Channel, number>> {
  const m = new Map<string, Record<Channel, number>>();
  for (const r of rows) {
    if (!m.has(r.date)) {
      const init = {} as Record<Channel, number>;
      for (const c of ["META", "GOOGLE", "EMAIL", "WHATSAPP", "ORGANIC", "DIRECT", "REFERRAL", "OTHER"] as Channel[]) {
        init[c] = 0;
      }
      m.set(r.date, init);
    }
    const day = m.get(r.date)!;
    day[r.channel] = (day[r.channel] ?? 0) + r.spend;
  }
  return m;
}

/**
 * Normal Equation linear regression: β = (XᵀX)⁻¹Xᵀy
 * With regularization (Ridge) for stability when columns are correlated.
 * Returns coefficients in the same order as X columns (excluding intercept).
 */
function ridgeRegression(X: number[][], y: number[], lambda: number = 1.0): number[] {
  const n = X.length;
  const p = X[0].length;
  // Add bias column
  const Xb: number[][] = X.map((row) => [1, ...row]);
  // Compute XᵀX (p+1 x p+1)
  const XtX: number[][] = Array.from({ length: p + 1 }, () => Array(p + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p + 1; j++) {
      for (let k = 0; k < p + 1; k++) {
        XtX[j][k] += Xb[i][j] * Xb[i][k];
      }
    }
  }
  // Add ridge regularization (skip bias row/col)
  for (let j = 1; j < p + 1; j++) XtX[j][j] += lambda;
  // Compute Xᵀy (p+1)
  const Xty: number[] = Array(p + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p + 1; j++) {
      Xty[j] += Xb[i][j] * y[i];
    }
  }
  // Solve (XᵀX) β = Xᵀy via Gauss-Jordan elimination
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  const m = aug.length;
  for (let i = 0; i < m; i++) {
    // Find pivot
    let pivot = i;
    for (let k = i + 1; k < m; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[pivot][i])) pivot = k;
    }
    [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
    // Normalize
    const div = aug[i][i];
    for (let j = i; j <= m; j++) aug[i][j] /= div;
    // Eliminate
    for (let k = 0; k < m; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = i; j <= m; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
  }
  // Last column is β
  return aug.map((row) => row[m]);
}

/**
 * R² coefficient of determination
 */
function rSquared(y: number[], yHat: number[]): number {
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    ssRes += Math.pow(y[i] - yHat[i], 2);
    ssTot += Math.pow(y[i] - mean, 2);
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

/**
 * Compute Marketing Mix Model coefficients from time-series spend + revenue data.
 *
 * @param datapoints daily (date, channel, spend) records
 * @param revenueByDate map of date → revenue/conversions
 * @returns MMM coefficients, ROI, and recommended reallocation
 */
export function fitMMM(
  datapoints: MMMDatapoint[],
  revenueByDate: Record<string, number>
): MMMResult {
  if (datapoints.length === 0) {
    return {
      baseline: 0,
      totalRevenue: 0,
      totalSpend: 0,
      overallROI: 0,
      rows: [],
      recommendedReallocation: [],
      trainedAt: new Date().toISOString()
    };
  }

  // Pivot data
  const pivoted = pivotByDate(datapoints);
  const dates = Array.from(pivoted.keys()).sort();

  // Channel list — preserve all 8 channels in fixed order for stable output
  const channels: Channel[] = ["META", "GOOGLE", "EMAIL", "WHATSAPP", "ORGANIC", "DIRECT", "REFERRAL", "OTHER"];

  // Build X matrix (one row per date, one column per channel)
  const X: number[][] = dates.map((d) => {
    const day = pivoted.get(d)!;
    return channels.map((c) => Math.log1p(day[c] ?? 0)); // log1p dampens huge spend spikes
  });

  // Build y vector (revenue per day)
  const y: number[] = dates.map((d) => Math.log1p(revenueByDate[d] ?? 0));

  // Apply adstock to each column
  const Xadstocked: number[][] = channels.map((_, cIdx) => {
    const colSeries = X.map((row) => row[cIdx]);
    return adstock(colSeries, 0.4, 7);
  });
  // Transpose back
  const Xfinal: number[][] = X.map((_, i) => Xadstocked.map((col) => col[i]));

  // Fit Ridge regression with regularization
  const beta = ridgeRegression(Xfinal, y, 1.0);
  const intercept = beta[0];
  const coeffs = beta.slice(1);

  // Predict and compute R²
  const yHat: number[] = Xfinal.map((row) => {
    let s = intercept;
    for (let c = 0; c < coeffs.length; c++) s += coeffs[c] * row[c];
    return s;
  });
  const r2 = Math.max(0, rSquared(y, yHat));

  // Aggregate by channel
  const totalRevenue = Object.values(revenueByDate).reduce((a, b) => a + b, 0);
  let totalSpend = 0;
  const byChannel = new Map<Channel, { spend: number; revenue: number }>();
  for (const c of channels) byChannel.set(c, { spend: 0, revenue: 0 });

  for (const [, day] of pivoted) {
    for (const c of channels) {
      const s = day[c] ?? 0;
      byChannel.get(c)!.spend += s;
      totalSpend += s;
    }
  }

  // Attribute revenue per channel using coefficients × adstocked spend
  const rows: MMMResultRow[] = [];
  for (let c = 0; c < channels.length; c++) {
    const channel = channels[c];
    const stat = byChannel.get(channel)!;
    const coeff = Math.max(0, coeffs[c] ?? 0); // clamp negatives — we assume diminishing returns
    // Predicted revenue attributable to this channel = coeff × total adstocked spend
    const totalAdstock = Xadstocked[c].reduce((a, b) => a + b, 0);
    const attributedRevenue = (coeff * totalAdstock) / Math.max(1, dates.length);
    const roi = stat.spend > 0 ? attributedRevenue / stat.spend : 0;
    const elasticity = coeff; // log-log coefficient ≈ elasticity
    rows.push({
      channel,
      coefficient: coeff,
      elasticity,
      totalSpend: stat.spend,
      attributedRevenue,
      roi,
      confidence: r2
    });
  }

  // Normalize attributed revenue to sum to totalRevenue (conservation)
  const sumAttributed = rows.reduce((a, r) => a + r.attributedRevenue, 0);
  if (sumAttributed > 0) {
    for (const r of rows) {
      r.attributedRevenue = (r.attributedRevenue / sumAttributed) * totalRevenue;
      r.roi = r.totalSpend > 0 ? r.attributedRevenue / r.totalSpend : 0;
    }
  }

  // Recommended reallocation: shift budget toward highest-ROI channels,
  // capped at 60% concentration (avoid over-fitting to one channel).
  const sortedByRoi = [...rows].sort((a, b) => b.roi - a.roi);
  const totalRecommended = totalSpend;
  const allocations = new Map<Channel, number>();
  for (const r of sortedByRoi) allocations.set(r.channel, 0);
  // Greedy: top channel gets up to 60%, next 25%, next 10%, rest split
  const caps = [0.6, 0.25, 0.1];
  let remaining = totalRecommended;
  for (let i = 0; i < sortedByRoi.length; i++) {
    const share = i < caps.length ? caps[i] : (0.05 / Math.max(1, sortedByRoi.length - caps.length));
    const give = Math.min(remaining, totalRecommended * share);
    allocations.set(sortedByRoi[i].channel, give);
    remaining -= give;
    if (remaining <= 0) break;
  }
  const recommendedReallocation = rows.map((r) => {
    const currentShare = totalSpend > 0 ? r.totalSpend / totalSpend : 0;
    const recBudget = allocations.get(r.channel) ?? 0;
    const recommendedShare = totalRecommended > 0 ? recBudget / totalRecommended : 0;
    let reason = "";
    if (recommendedShare > currentShare + 0.05) {
      reason = `${r.channel} has ${r.roi.toFixed(2)}x ROI — highest in the mix. Increase share.`;
    } else if (recommendedShare < currentShare - 0.05) {
      reason = `${r.channel} underperforms at ${r.roi.toFixed(2)}x ROI. Reduce share.`;
    } else {
      reason = `${r.channel} is near-optimal. Maintain.`;
    }
    return {
      channel: r.channel,
      currentShare,
      recommendedShare,
      reason
    };
  });

  return {
    baseline: Math.exp(intercept),
    totalRevenue,
    totalSpend,
    overallROI: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    rows: rows.sort((a, b) => b.roi - a.roi),
    recommendedReallocation,
    trainedAt: new Date().toISOString()
  };
}
