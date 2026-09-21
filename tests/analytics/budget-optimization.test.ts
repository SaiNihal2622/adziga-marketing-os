import { describe, it, expect } from "vitest";
import { optimizeBudget } from "@/lib/analytics/budget-optimization";
import type { Channel } from "@/lib/analytics/types";

describe("Budget Optimization (Thompson Sampling + MAB)", () => {
  it("allocates full budget across arms", () => {
    const r = optimizeBudget({
      totalBudget: 10000,
      arms: [
        { channel: "META" as Channel, successes: 10, failures: 5, spend: 1000, revenue: 5000 },
        { channel: "GOOGLE" as Channel, successes: 8, failures: 7, spend: 1000, revenue: 4000 },
        { channel: "EMAIL" as Channel, successes: 5, failures: 10, spend: 500, revenue: 1000 }
      ]
    });
    const totalAllocated = r.allocations.reduce((s, a) => s + a.allocatedBudget, 0);
    expect(totalAllocated).toBeCloseTo(10000, -2);
  });

  it("returns confidence intervals for every arm", () => {
    const r = optimizeBudget({
      totalBudget: 5000,
      arms: [
        { channel: "META" as Channel, successes: 1, failures: 1, spend: 100, revenue: 0 },
        { channel: "GOOGLE" as Channel, successes: 1, failures: 1, spend: 100, revenue: 0 }
      ]
    });
    for (const alloc of r.allocations) {
      expect(alloc.confidenceInterval).toHaveLength(2);
      expect(alloc.confidenceInterval[0]).toBeLessThanOrEqual(alloc.confidenceInterval[1]);
    }
  });

  it("explores all arms even with no data", () => {
    const r = optimizeBudget({
      totalBudget: 8000,
      arms: [
        { channel: "META" as Channel, successes: 0, failures: 0, spend: 0, revenue: 0 },
        { channel: "GOOGLE" as Channel, successes: 0, failures: 0, spend: 0, revenue: 0 },
        { channel: "EMAIL" as Channel, successes: 0, failures: 0, spend: 0, revenue: 0 },
        { channel: "WHATSAPP" as Channel, successes: 0, failures: 0, spend: 0, revenue: 0 }
      ]
    });
    // With no evidence, allocation should be roughly uniform (1/4 each)
    for (const alloc of r.allocations) {
      expect(alloc.allocatedBudget).toBeGreaterThan(0);
    }
    const total = r.allocations.reduce((s, a) => s + a.allocatedBudget, 0);
    expect(total).toBeCloseTo(8000, -2);
  });

  it("favors higher-converting arms", () => {
    const r = optimizeBudget({
      totalBudget: 10000,
      arms: [
        { channel: "META" as Channel, successes: 50, failures: 5, spend: 1000, revenue: 50000 },
        { channel: "DIRECT" as Channel, successes: 1, failures: 50, spend: 1000, revenue: 100 }
      ]
    });
    const good = r.allocations.find((a) => a.channel === "META")!;
    const bad = r.allocations.find((a) => a.channel === "DIRECT")!;
    expect(good.allocatedBudget).toBeGreaterThan(bad.allocatedBudget);
  });
});
