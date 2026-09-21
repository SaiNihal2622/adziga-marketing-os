import { describe, it, expect } from "vitest";
import { computeAttribution } from "@/lib/analytics/attribution";
import type { Channel } from "@/lib/analytics/types";

describe("Multi-touch Attribution (Shapley values)", () => {
  it("returns zero credits for non-converted leads", () => {
    const r = computeAttribution({
      leadId: "l1",
      converted: false,
      touchpoints: [
        { channel: "META" as Channel, occurredAt: "2026-01-01T00:00:00Z" },
        { channel: "GOOGLE" as Channel, occurredAt: "2026-01-02T00:00:00Z" }
      ]
    });
    expect(r.totalCredit).toBe(0);
  });

  it("normalizes credits to sum=1 for converted leads", () => {
    const r = computeAttribution({
      leadId: "l1",
      converted: true,
      touchpoints: [
        { channel: "META" as Channel, occurredAt: "2026-01-01T00:00:00Z" },
        { channel: "GOOGLE" as Channel, occurredAt: "2026-01-02T00:00:00Z" },
        { channel: "DIRECT" as Channel, occurredAt: "2026-01-03T00:00:00Z" }
      ]
    });
    const total = Object.values(r.channelCredits).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it("single touchpoint gets full credit", () => {
    const r = computeAttribution({
      leadId: "l1",
      converted: true,
      touchpoints: [{ channel: "META" as Channel, occurredAt: "2026-01-01T00:00:00Z" }]
    });
    expect(r.channelCredits["META"]).toBeCloseTo(1, 1);
  });

  it("symmetric coalition gives equal Shapley values", () => {
    const r = computeAttribution({
      leadId: "l1",
      converted: true,
      touchpoints: [
        { channel: "META" as Channel, occurredAt: "2026-01-01T00:00:00Z" },
        { channel: "GOOGLE" as Channel, occurredAt: "2026-01-01T00:00:00Z" }
      ]
    });
    expect(r.channelCredits["META"]).toBeCloseTo(r.channelCredits["GOOGLE"], 2);
  });

  it("handles 8 touchpoints (O(2^8 * 8) = 2048 subsets)", () => {
    const channels: Channel[] = ["META", "GOOGLE", "EMAIL", "WHATSAPP", "DIRECT", "ORGANIC", "REFERRAL", "OTHER"];
    const touchpoints = channels.map((ch, i) => ({
      channel: ch,
      occurredAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`
    }));
    const start = Date.now();
    const r = computeAttribution({
      leadId: "l1",
      converted: true,
      touchpoints
    });
    const elapsed = Date.now() - start;
    expect(Object.keys(r.channelCredits)).toHaveLength(8);
    expect(elapsed).toBeLessThan(2000); // must complete in under 2 seconds
  });
});
