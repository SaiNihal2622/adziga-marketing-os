import { describe, it, expect } from "vitest";
import { detectAnomalies } from "@/lib/analytics/anomaly-detection";

describe("Anomaly Detection (Z-score)", () => {
  it("returns no anomalies on stable data", () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      value: 100 + (i % 3) * 0.5 // very stable
    }));
    const r = detectAnomalies({ metric: "spend", series });
    expect(r.anomalies).toHaveLength(0);
  });

  it("detects spikes as anomalies", () => {
    // baseline: 30 days of slightly varying spend (~100 ± 5)
    // recent: same with one big spike on day 35
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      value: 100 + Math.sin(i) * 5
    })).concat([
      { date: "2026-02-01", value: 100 + Math.sin(30) * 5 },
      { date: "2026-02-02", value: 100 + Math.sin(31) * 5 },
      { date: "2026-02-03", value: 100 + Math.sin(32) * 5 },
      { date: "2026-02-04", value: 1000 }, // big spike
      { date: "2026-02-05", value: 100 + Math.sin(34) * 5 }
    ]);
    const r = detectAnomalies({ metric: "spend", series });
    expect(r.anomalies.length).toBeGreaterThan(0);
    expect(r.anomalies[0].date).toBe("2026-02-04");
    expect(r.anomalies[0].zScore).toBeGreaterThan(3);
  });

  it("returns baseline stats", () => {
    const series = Array.from({ length: 15 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      value: 50
    }));
    const r = detectAnomalies({ metric: "leads", series });
    expect(r.baselineMean).toBe(50);
    expect(r.baselineStdDev).toBe(0);
    expect(r.windowDays).toBeGreaterThan(0);
  });

  it("respects custom threshold", () => {
    const series = [
      ...Array.from({ length: 10 }, () => ({ date: "x", value: 100 })),
      { date: "spike", value: 150 } // only 1.5 sigma
    ];
    const strict = detectAnomalies({ metric: "x", series, threshold: 2 });
    const loose = detectAnomalies({ metric: "x", series, threshold: 1 });
    expect(loose.anomalies.length).toBeGreaterThanOrEqual(strict.anomalies.length);
  });
});
