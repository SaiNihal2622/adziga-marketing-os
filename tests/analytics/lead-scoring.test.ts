import { describe, it, expect } from "vitest";
import { scoreLead, scoreLeads, defaultModel, featurize } from "@/lib/analytics/lead-scoring";
import type { LeadFeatures } from "@/lib/analytics/types";

describe("Predictive Lead Scoring (Logistic regression)", () => {
  it("featurize produces a fixed-length feature vector", () => {
    const f = featurize({
      source: "META",
      daysSinceCreated: 5,
      emailOpens: 2,
      emailClicks: 1,
      websiteVisits: 3,
      formSubmissions: 0,
      hasPhone: 1,
      hasCompany: 1,
      cityTier: 1,
      previousEngagementScore: 50,
      recencyDays: 5,
      frequency: 1
    });
    expect(f.length).toBeGreaterThan(10);
  });

  it("defaultModel gives reasonable score for typical lead", () => {
    const features: LeadFeatures = {
      leadId: "l1",
      source: "META",
      daysSinceCreated: 3,
      emailOpens: 1,
      emailClicks: 0,
      websiteVisits: 1,
      formSubmissions: 0,
      hasPhone: 1,
      hasCompany: 1,
      cityTier: 1,
      previousEngagementScore: 50,
      recencyDays: 3,
      frequency: 1
    };
    const r = scoreLead(defaultModel(), features);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.probability).toBeGreaterThan(0);
    expect(r.probability).toBeLessThan(1);
    expect(Array.isArray(r.topFactors)).toBe(true);
  });

  it("scoreLeads handles multiple leads in batch", () => {
    const model = defaultModel();
    const leads: LeadFeatures[] = [
      {
        leadId: "l1",
        source: "META",
        daysSinceCreated: 1,
        emailOpens: 5,
        emailClicks: 3,
        websiteVisits: 10,
        formSubmissions: 1,
        hasPhone: 1,
        hasCompany: 1,
        cityTier: 2,
        previousEngagementScore: 90,
        recencyDays: 1,
        frequency: 5
      },
      {
        leadId: "l2",
        source: "ORGANIC",
        daysSinceCreated: 30,
        emailOpens: 0,
        emailClicks: 0,
        websiteVisits: 0,
        formSubmissions: 0,
        hasPhone: 0,
        hasCompany: 0,
        cityTier: 0,
        previousEngagementScore: 10,
        recencyDays: 30,
        frequency: 0
      }
    ];
    const results = scoreLeads(model, leads);
    expect(results).toHaveLength(2);
    // Hot lead should score higher than cold lead
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});
