// Adziga Content Intelligence - Phase 3
// Analyzes creative library to find patterns that correlate with business outcomes.
// Per spec ??9 - hooks, formats, copy, CTAs, video structures, audience responses.

import { prisma } from "../db";

export type ContentInsight = {
  patternType: string;
  pattern: string;
  occurrences: number;
  totalSpend: number;
  totalLeads: number;
  totalRevenue: number;
  cpl: number;
  ctr: number;
  convRate: number;
  roas: number;
  confidence: number;
  verdict: "strong" | "promising" | "neutral" | "weak";
};

export const CONTENT_MODEL = "adziga-content-v1";

/**
 * Recompute content patterns from the existing creative library.
 * For each pattern type, aggregate per-pattern metrics.
 */
export async function recomputeContentPatterns(orgId: string): Promise<{
  patternsAnalyzed: number;
  insights: ContentInsight[];
}> {
  const creatives = await prisma.creative.findMany({ where: { orgId } });
  const patternsAnalyzed = creatives.length;

  // Aggregate per pattern type
  type Bucket = { occurrences: number; spend: number; leads: number; revenue: number; clicks: number; impressions: number; conv: number };
  const buckets: Record<string, Record<string, Bucket>> = {
    format: {},
    platform: {},
    hook: {},
    cta: {}
  };

  for (const c of creatives) {
    const addTo = (type: string, key: string) => {
      if (!key) return;
      if (!buckets[type][key]) buckets[type][key] = { occurrences: 0, spend: 0, leads: 0, revenue: 0, clicks: 0, impressions: 0, conv: 0 };
      buckets[type][key].occurrences += 1;
      buckets[type][key].spend += c.spend;
      buckets[type][key].leads += Number(c.leads);
      buckets[type][key].revenue += c.revenue;
      buckets[type][key].impressions += Number(c.impressions);
      // CTR - use creative's own field
    };

    addTo("format", c.format);
    addTo("platform", c.platform);
    if (c.hook) addTo("hook", c.hook.toLowerCase().trim());
    if (c.cta) addTo("cta", c.cta.toLowerCase().trim());
  }

  // Also bucket ctr per pattern (use creative's own ctr field as a weighted indicator)
  for (const c of creatives) {
    const w = c.ctr ?? 0;
    if (c.format && buckets.format[c.format]) buckets.format[c.format].clicks += w * Number(c.impressions) / 100;
    if (c.platform && buckets.platform[c.platform]) buckets.platform[c.platform].clicks += w * Number(c.impressions) / 100;
    if (c.hook && buckets.hook[c.hook.toLowerCase().trim()]) buckets.hook[c.hook.toLowerCase().trim()].clicks += w * Number(c.impressions) / 100;
    if (c.cta && buckets.cta[c.cta.toLowerCase().trim()]) buckets.cta[c.cta.toLowerCase().trim()].clicks += w * Number(c.impressions) / 100;
  }

  // Persist
  await prisma.contentPattern.deleteMany({ where: { orgId } });

  const insights: ContentInsight[] = [];

  for (const [type, groups] of Object.entries(buckets)) {
    for (const [pattern, b] of Object.entries(groups)) {
      const cpl = b.leads > 0 ? b.spend / b.leads : 0;
      const ctr = b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0;
      const convRate = b.leads > 0 ? (b.conv / b.leads) * 100 : 0;
      const roas = b.spend > 0 ? b.revenue / b.spend : 0;

      // Confidence: more occurrences + more leads = higher confidence
      const confidence = Math.min(0.95, 0.3 + b.occurrences * 0.05 + (b.leads > 0 ? Math.min(0.4, b.leads / 1000) : 0));

      let verdict: ContentInsight["verdict"] = "neutral";
      if (confidence > 0.6 && roas > 3) verdict = "strong";
      else if (confidence > 0.5 && roas > 2) verdict = "promising";
      else if (confidence > 0.5 && roas < 1) verdict = "weak";

      await prisma.contentPattern.create({
        data: {
          orgId,
          patternType: type,
          pattern,
          appearances: b.occurrences,
          totalSpend: b.spend,
          totalLeads: b.leads,
          totalRevenue: b.revenue,
          cpl,
          ctr,
          convRate,
          roas,
          sampleSize: b.leads,
          confidence
        }
      });

      insights.push({
        patternType: type,
        pattern,
        occurrences: b.occurrences,
        totalSpend: b.spend,
        totalLeads: b.leads,
        totalRevenue: b.revenue,
        cpl,
        ctr,
        convRate,
        roas,
        confidence,
        verdict
      });
    }
  }

  // Sort insights by verdict + roas for output
  const verdictOrder = { strong: 0, promising: 1, neutral: 2, weak: 3 };
  insights.sort((a, b) => verdictOrder[a.verdict] - verdictOrder[b.verdict] || b.roas - a.roas);

  return { patternsAnalyzed, insights };
}

/**
 * Suggest a creative based on historical winning patterns.
 */
export async function suggestCreative(orgId: string, params: {
  industry: string;
  audience: string;
  platform: string;
  goal: "lead_gen" | "awareness" | "conversion";
}): Promise<{
  recommendedFormat: string;
  recommendedHookPattern: string;
  recommendedCtaPattern: string;
  expectedCtr: number;
  expectedCpl: number;
  rationale: string;
}> {
  // Pull winning patterns
  const patterns = await prisma.contentPattern.findMany({
    where: { orgId, confidence: { gt: 0.4 } }
  });

  // Best format for platform
  const platformPatterns = patterns.filter((p) => p.patternType === "platform" && p.pattern === params.platform);
  const formatPatterns = patterns.filter((p) => p.patternType === "format" && (p.verdict === "strong" || p.verdict === "promising"));
  const hookPatterns = patterns.filter((p) => p.patternType === "hook" && (p.verdict === "strong" || p.verdict === "promising"));
  const ctaPatterns = patterns.filter((p) => p.patternType === "cta" && (p.verdict === "strong" || p.verdict === "promising"));

  const bestFormat = formatPatterns.sort((a, b) => b.roas - a.roas)[0];
  const bestHook = hookPatterns.sort((a, b) => b.roas - a.roas)[0];
  const bestCta = ctaPatterns.sort((a, b) => b.roas - a.roas)[0];

  const recommendedFormat = bestFormat?.pattern ?? (params.goal === "awareness" ? "VIDEO" : params.goal === "lead_gen" ? "CAROUSEL" : "IMAGE");
  const recommendedHookPattern = bestHook?.pattern ?? (params.goal === "awareness" ? "question-based hook" : params.goal === "lead_gen" ? "social proof hook" : "offer-led hook");
  const recommendedCtaPattern = bestCta?.pattern ?? (params.goal === "conversion" ? "Book Now" : params.goal === "lead_gen" ? "Get Free Guide" : "Learn More");

  // Estimate expected CTR / CPL from historical medians
  const platformBaseline = platformPatterns[0] ?? formatPatterns.sort((a, b) => a.cpl - b.cpl)[0];
  const expectedCtr = platformBaseline?.ctr ?? 2.0;
  const expectedCpl = platformBaseline?.cpl ?? (params.goal === "lead_gen" ? 500 : 800);

  const rationale = bestFormat
    ? `Based on ${formatPatterns.length} format patterns with confidence >0.4, "${bestFormat.pattern}" wins with ${bestFormat.roas.toFixed(1)}x ROAS over ${bestFormat.appearances} appearances.`
    : `No strong format pattern found - recommending default "${recommendedFormat}" for ${params.platform} ${params.goal}.`;

  return {
    recommendedFormat,
    recommendedHookPattern,
    recommendedCtaPattern,
    expectedCtr: Math.round(expectedCtr * 100) / 100,
    expectedCpl: Math.round(expectedCpl),
    rationale
  };
}