import { describe, it, expect } from "vitest";
import { fitMMM, adstock } from "@/lib/analytics/mmm";

describe("Marketing Mix Modeling (Ridge regression + adstock)", () => {
  it("returns empty result for empty datapoints", () => {
    const r = fitMMM([], {});
    expect(r.rows).toEqual([]);
    expect(r.totalRevenue).toBe(0);
    expect(r.totalSpend).toBe(0);
    expect(r.overallROI).toBe(0);
  });

  it("adstock transformation decays geometrically", () => {
    const t = adstock([100, 0, 0, 0], 0.5);
    // Default maxLag=7 — adstock sums prior weighted spend
    expect(t[0]).toBeCloseTo(100);
    expect(t[1]).toBeCloseTo(50); // 0 + 100 * 0.5
    expect(t[2]).toBeCloseTo(25); // 0 + 50 * 0.5
    expect(t[3]).toBeCloseTo(12.5);
  });

  it("adstock carries forward previous spend", () => {
    const t = adstock([100, 100, 0, 0], 0.5);
    expect(t[0]).toBeCloseTo(100);
    expect(t[1]).toBeCloseTo(150); // 100 + 100*0.5
    expect(t[2]).toBeCloseTo(75); // 0 + 100*0.5 + 100*0.25
    expect(t[3]).toBeCloseTo(37.5);
  });

  it("returns correct overallROI on simple data", () => {
    const dat = [
      { date: "2026-01-01", channel: "META" as const, spend: 1000 },
      { date: "2026-01-02", channel: "META" as const, spend: 1000 },
      { date: "2026-01-03", channel: "META" as const, spend: 1000 }
    ];
    const rev = { "2026-01-01": 0, "2026-01-02": 0, "2026-01-03": 5000 };
    const r = fitMMM(dat, rev);
    expect(r.totalSpend).toBe(3000);
    expect(r.totalRevenue).toBe(5000);
    expect(r.overallROI).toBeCloseTo(5000 / 3000);
  });

  it("produces a row per channel", () => {
    const dat = [
      { date: "2026-01-01", channel: "META" as const, spend: 100 },
      { date: "2026-01-01", channel: "GOOGLE" as const, spend: 200 }
    ];
    const r = fitMMM(dat, { "2026-01-01": 0 });
    const channels = r.rows.map((row) => row.channel);
    expect(channels).toContain("META");
    expect(channels).toContain("GOOGLE");
  });

  it("reallocations sum to roughly 1.0", () => {
    const dat = [];
    const channels: Array<"META" | "GOOGLE" | "EMAIL"> = ["META", "GOOGLE", "EMAIL"];
    for (let i = 0; i < 30; i++) {
      const day = `2026-01-${String(i + 1).padStart(2, "0")}`;
      for (const ch of channels) {
        dat.push({ date: day, channel: ch, spend: 100 + Math.random() * 50 });
      }
    }
    const rev: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const day = `2026-01-${String(i + 1).padStart(2, "0")}`;
      rev[day] = 1000 + Math.random() * 200;
    }
    const r = fitMMM(dat, rev);
    const totalShare = r.recommendedReallocation.reduce((s, x) => s + x.recommendedShare, 0);
    expect(totalShare).toBeGreaterThan(0.95);
    expect(totalShare).toBeLessThan(1.05);
  });
});
