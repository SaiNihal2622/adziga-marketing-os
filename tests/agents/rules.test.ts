import { describe, it, expect } from "vitest";
import { TOOL_BY_NAME, ALL_TOOLS, toolsForAgent } from "@/server/agents/types";

describe("Agent tool registry", () => {
  it("has tools for every phase of marketing ops", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names).toContain("campaign.create");
    expect(names).toContain("campaign.pause");
    expect(names).toContain("creative.create");
    expect(names).toContain("lead.score");
    expect(names).toContain("budget.allocate");
    expect(names).toContain("analytics.mmm");
    expect(names).toContain("analytics.attribution");
    expect(names).toContain("analytics.anomalies");
    expect(names).toContain("competitor.recordAd");
  });

  it("toolsForAgent filters by permission allowlist", () => {
    const tools = toolsForAgent("campaign.create,campaign.pause,analytics.read");
    const names = tools.map((t) => t.name);
    expect(names).toContain("campaign.create");
    expect(names).toContain("campaign.pause");
    expect(names).toContain("analytics.mmm");
    expect(names).toContain("analytics.attribution");
    expect(names).not.toContain("lead.score"); // not in allowlist
    expect(names).not.toContain("creative.create");
  });

  it("toolsForAgent with empty allowlist returns nothing", () => {
    expect(toolsForAgent("")).toHaveLength(0);
    expect(toolsForAgent("   ")).toHaveLength(0);
  });

  it("every tool has a name, description, requires, and handler", () => {
    for (const t of ALL_TOOLS) {
      expect(t.name).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.requires).toBeTruthy();
      expect(typeof t.handler).toBe("function");
    }
  });

  it("TOOL_BY_NAME is a complete index", () => {
    for (const t of ALL_TOOLS) {
      expect(TOOL_BY_NAME[t.name]).toBe(t);
    }
  });

  it("every tool's required permission matches its name prefix", () => {
    // E.g. campaign.create requires "campaign.create"; analytics.mmm requires "analytics.read"
    for (const t of ALL_TOOLS) {
      if (t.name.startsWith("campaign.")) {
        expect(t.requires.startsWith("campaign.")).toBe(true);
      } else if (t.name.startsWith("analytics.")) {
        expect(t.requires).toBe("analytics.read");
      } else if (t.name.startsWith("budget.")) {
        expect(t.requires).toMatch(/^budget\./);
      } else if (t.name.startsWith("creative.")) {
        expect(t.requires.startsWith("creative.")).toBe(true);
      } else if (t.name.startsWith("lead.")) {
        expect(t.requires.startsWith("lead.")).toBe(true);
      } else if (t.name.startsWith("competitor.")) {
        expect(t.requires.startsWith("competitor.")).toBe(true);
      }
    }
  });
});
