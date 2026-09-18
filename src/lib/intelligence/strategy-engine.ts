// Adziga Strategy Intelligence - Phase 2
// Given business ?? audience ?? budget  recommended configuration
// Uses historical structured data + industry benchmarks
// Returns confidence-scored recommendations (NOT autonomous decisions).

import { prisma } from "../db";

export type StrategyInputs = {
  industry: string;
  objective: string; // lead_gen | awareness | conversion | revenue
  monthlyBudget: number; // INR
  region?: string; // IN | US | ...
  audience?: {
    tier?: string; // tier-1 | tier-2 | tier-3
    b2b_b2c?: string; // B2B | B2C
    ageMin?: number;
    ageMax?: number;
  };
  // Optional existing client context
  clientId?: string;
  orgId: string;
};

export type ChannelRecommendation = {
  channel: string;
  platform: string;
  allocationPct: number;
  expectedCpl: number;
  expectedCtr: number;
  expectedConv: number;
  rationale: string;
};

export type StrategyOutput = {
  channels: ChannelRecommendation[];
  expectedCpl: number;
  expectedCac: number;
  expectedRoas: number;
  confidence: number; // 0-1
  reasoning: {
    basedOnSample: number;
    similarClients: Array<{ name: string; cpl: number; roas: number }>;
    benchmarksUsed: Array<{ channel: string; cpl: number; source: string }>;
    notes: string[];
  };
  // Meta
  computedAt: string;
  model: string;
};

export const STRATEGY_MODEL = "adziga-strategy-v1";

// Channel ?? objective allocation priors (when no historical data exists)
const DEFAULT_ALLOCATION: Record<string, Record<string, number>> = {
  lead_gen: {
    META: 0.35,
    GOOGLE: 0.30,
    YOUTUBE: 0.10,
    INFLUENCER: 0.10,
    EVENT: 0.10,
    EMAIL: 0.05
  },
  awareness: {
    META: 0.30,
    YOUTUBE: 0.25,
    INSTAGRAM: 0.15,
    INFLUENCER: 0.20,
    GOOGLE: 0.05,
    EVENT: 0.05
  },
  conversion: {
    GOOGLE: 0.35,
    META: 0.30,
    EMAIL: 0.15,
    WHATSAPP: 0.10,
    REMARKETING: 0.10
  },
  revenue: {
    META: 0.30,
    GOOGLE: 0.25,
    EMAIL: 0.20,
    WHATSAPP: 0.15,
    INFLUENCER: 0.10
  }
};

export async function recommendStrategy(inputs: StrategyInputs): Promise<StrategyOutput> {
  const region = inputs.region ?? "IN";

  // 1) Pull industry benchmarks
  const benchmarks = await prisma.industryBenchmark.findMany({
    where: { industry: inputs.industry, objective: inputs.objective, region }
  });

  // 2) Pull similar historical data from this org's past campaigns
  const similarCampaigns = await prisma.campaign.findMany({
    where: {
      orgId: inputs.orgId,
      status: { in: ["ACTIVE", "COMPLETED", "PAUSED"] }
    },
    take: 50
  });

  // 3) Compute channel performance from similar campaigns
  const channelPerf: Record<string, { spend: number; leads: number; clicks: number; impressions: number; conv: number; revenue: number }> = {};
  for (const c of similarCampaigns) {
    if (Number(c.leads) === 0 && c.spent > 0) continue; // skip dead campaigns
    const k = c.platform;
    if (!channelPerf[k]) channelPerf[k] = { spend: 0, leads: 0, clicks: 0, impressions: 0, conv: 0, revenue: 0 };
    channelPerf[k].spend += c.spent;
    channelPerf[k].leads += Number(c.leads);
    channelPerf[k].clicks += Number(c.clicks);
    channelPerf[k].impressions += Number(c.impressions);
    channelPerf[k].conv += Number(c.customers);
    channelPerf[k].revenue += c.revenue;
  }

  const hasHistoricalData = Object.keys(channelPerf).length > 0;

  // 4) Decide allocation
  const allocPrior = DEFAULT_ALLOCATION[inputs.objective] ?? DEFAULT_ALLOCATION.lead_gen;
  const channels: ChannelRecommendation[] = [];

  // Determine total channels
  const channelKeys = Object.keys(allocPrior);

  for (const ch of channelKeys) {
    const prior = allocPrior[ch];
    let expectedCpl = 0;
    let expectedCtr = 0;
    let expectedConv = 0;
    let rationale = "";
    let source = "default prior";

    // Try benchmark first
    const bench = benchmarks.find((b) => b.channel === ch);
    if (bench) {
      expectedCpl = bench.cplMedian;
      expectedCtr = bench.ctrMedian;
      expectedConv = bench.convMedian;
      rationale = `Industry benchmark for ${inputs.industry}/${inputs.objective}/${ch} (sample n=${bench.sampleSize})`;
      source = "benchmark";
    }

    // Override with historical data if available
    const hist = channelPerf[ch];
    if (hist && hist.leads > 0) {
      const histCpl = hist.spend / hist.leads;
      const histCtr = hist.impressions > 0 ? (hist.clicks / hist.impressions) * 100 : 0;
      const histConv = hist.leads > 0 ? (hist.conv / hist.leads) * 100 : 0;

      // Blend: 70% historical, 30% benchmark
      if (bench) {
        expectedCpl = histCpl * 0.7 + bench.cplMedian * 0.3;
        expectedCtr = histCtr * 0.7 + bench.ctrMedian * 0.3;
        expectedConv = histConv * 0.7 + bench.convMedian * 0.3;
        rationale = `Blend: 70% your history (CPL ${histCpl.toFixed(0)}) + 30% industry benchmark (${bench.cplMedian.toFixed(0)})`;
      } else {
        expectedCpl = histCpl;
        expectedCtr = histCtr;
        expectedConv = histConv;
        rationale = `Based on ${hist.leads} leads from your ${similarCampaigns.filter((c) => c.platform === ch).length} ${ch} campaigns`;
      }
      source = "historical";
    } else if (!bench) {
      // No data at all - use a conservative prior
      expectedCpl = inputs.objective === "lead_gen" ? 500 : inputs.objective === "awareness" ? 100 : 1000;
      expectedCtr = 1.5;
      expectedConv = inputs.objective === "lead_gen" ? 5 : inputs.objective === "conversion" ? 2 : 1;
      rationale = `No historical data or benchmark available; using conservative defaults`;
      source = "default";
    }

    channels.push({
      channel: ch,
      platform: ch,
      allocationPct: Math.round(prior * 100),
      expectedCpl: Math.round(expectedCpl),
      expectedCtr: Math.round(expectedCtr * 100) / 100,
      expectedConv: Math.round(expectedConv * 100) / 100,
      rationale
    });
  }

  // 5) Sort by expected efficiency (lower CPL per allocation = higher rank)
  channels.sort((a, b) => (a.expectedCpl / Math.max(a.allocationPct, 1)) - (b.expectedCpl / Math.max(b.allocationPct, 1)));

  // 6) Aggregate expected outcomes
  const totalAllocation = channels.reduce((s, c) => s + c.allocationPct, 0);
  const normalizedChannels = channels.map((c) => ({ ...c, allocationPct: Math.round((c.allocationPct / totalAllocation) * 100) }));

  const blendedCpl = normalizedChannels.reduce((s, c) => s + (c.expectedCpl * c.allocationPct) / 100, 0);
  const expectedLeads = inputs.monthlyBudget / blendedCpl;
  const expectedCust = expectedLeads * (normalizedChannels.reduce((s, c) => s + c.expectedConv, 0) / normalizedChannels.length) / 100;
  const expectedCac = expectedCust > 0 ? inputs.monthlyBudget / expectedCust : 0;
  const expectedRevenue = expectedCust * (inputs.monthlyBudget * 0.3); // assume avg ticket = 0.3x budget
  const expectedRoas = inputs.monthlyBudget > 0 ? expectedRevenue / inputs.monthlyBudget : 0;

  // 7) Confidence - based on data availability
  let confidence = 0.3; // base
  if (hasHistoricalData) confidence += 0.3;
  if (benchmarks.length >= 3) confidence += 0.2;
  if (similarCampaigns.length >= 10) confidence += 0.1;
  if (similarCampaigns.length >= 25) confidence += 0.1;
  confidence = Math.min(0.95, confidence);

  // 8) Find similar clients (orgs with similar industry/budget)
  const similarClients: Array<{ name: string; cpl: number; roas: number }> = [];
  // We don't have other Adziga orgs to query, so we use the org's own clients
  const clients = await prisma.client.findMany({
    where: { orgId: inputs.orgId, industry: inputs.industry }
  });
  for (const c of clients.slice(0, 3)) {
    const cs = await prisma.campaign.findMany({ where: { clientId: c.id } });
    const totalSp = cs.reduce((s, x) => s + x.spent, 0);
    const totalLd = cs.reduce((s, x) => s + Number(x.leads), 0);
    const totalRev = cs.reduce((s, x) => s + x.revenue, 0);
    similarClients.push({
      name: c.businessName,
      cpl: totalLd > 0 ? totalSp / totalLd : 0,
      roas: totalSp > 0 ? totalRev / totalSp : 0
    });
  }

  const benchmarksUsed = benchmarks.map((b) => ({ channel: b.channel, cpl: b.cplMedian, source: "industry" }));

  const notes: string[] = [];
  if (!hasHistoricalData) notes.push("Insufficient historical data - recommend running 2-3 pilot campaigns before scaling budget.");
  if (benchmarks.length === 0) notes.push("No industry benchmark for this exact niche - defaults used.");
  if (confidence < 0.5) notes.push("Low confidence - treat as directional only, not as a commitment.");

  const output: StrategyOutput = {
    channels: normalizedChannels,
    expectedCpl: Math.round(blendedCpl),
    expectedCac: Math.round(expectedCac),
    expectedRoas: Math.round(expectedRoas * 100) / 100,
    confidence,
    reasoning: {
      basedOnSample: similarCampaigns.length,
      similarClients,
      benchmarksUsed,
      notes
    },
    computedAt: new Date().toISOString(),
    model: STRATEGY_MODEL
  };

  // Persist the recommendation
  await prisma.strategyRecommendation.create({
    data: {
      orgId: inputs.orgId,
      clientId: inputs.clientId,
      industry: inputs.industry,
      objective: inputs.objective,
      monthlyBudget: inputs.monthlyBudget,
      inputs: JSON.stringify(inputs),
      recommendedChannels: JSON.stringify(normalizedChannels),
      expectedCpl: output.expectedCpl,
      expectedCac: output.expectedCac,
      expectedRoas: output.expectedRoas,
      confidence,
      reasoning: JSON.stringify(output.reasoning),
      status: "PROPOSED"
    }
  });

  return output;
}

// Seed default industry benchmarks (in production, these would come from a real benchmark database)
export async function seedBenchmarks() {
  const existing = await prisma.industryBenchmark.count();
  if (existing > 0) return { seeded: 0 };

  const rows = [
    // Real Estate
    { industry: "Real Estate", objective: "lead_gen", channel: "META", cplMin: 200, cplMedian: 600, cplMax: 1500, ctrMedian: 1.8, convMedian: 4.5, sampleSize: 120, region: "IN" },
    { industry: "Real Estate", objective: "lead_gen", channel: "GOOGLE", cplMin: 300, cplMedian: 850, cplMax: 2000, ctrMedian: 3.2, convMedian: 5.5, sampleSize: 80, region: "IN" },
    { industry: "Real Estate", objective: "lead_gen", channel: "INFLUENCER", cplMin: 400, cplMedian: 1100, cplMax: 2500, ctrMedian: 1.2, convMedian: 6.0, sampleSize: 30, region: "IN" },
    { industry: "Real Estate", objective: "lead_gen", channel: "EVENT", cplMin: 250, cplMedian: 700, cplMax: 1500, ctrMedian: 0, convMedian: 12.0, sampleSize: 25, region: "IN" },
    // Financial Services
    { industry: "Financial Services", objective: "lead_gen", channel: "META", cplMin: 150, cplMedian: 450, cplMax: 1200, ctrMedian: 2.1, convMedian: 3.8, sampleSize: 200, region: "IN" },
    { industry: "Financial Services", objective: "lead_gen", channel: "LINKEDIN", cplMin: 500, cplMedian: 1200, cplMax: 3000, ctrMedian: 0.6, convMedian: 5.5, sampleSize: 90, region: "IN" },
    { industry: "Financial Services", objective: "lead_gen", channel: "GOOGLE", cplMin: 200, cplMedian: 550, cplMax: 1500, ctrMedian: 3.5, convMedian: 4.5, sampleSize: 150, region: "IN" },
    // E-commerce (default)
    { industry: "E-commerce", objective: "conversion", channel: "META", cplMin: 80, cplMedian: 220, cplMax: 500, ctrMedian: 2.5, convMedian: 3.0, sampleSize: 300, region: "IN" },
    { industry: "E-commerce", objective: "conversion", channel: "GOOGLE", cplMin: 100, cplMedian: 280, cplMax: 600, ctrMedian: 4.0, convMedian: 3.5, sampleSize: 250, region: "IN" },
    { industry: "SaaS", objective: "lead_gen", channel: "LINKEDIN", cplMin: 400, cplMedian: 1000, cplMax: 2500, ctrMedian: 0.7, convMedian: 4.0, sampleSize: 70, region: "IN" },
    { industry: "SaaS", objective: "lead_gen", channel: "GOOGLE", cplMin: 250, cplMedian: 700, cplMax: 1500, ctrMedian: 3.8, convMedian: 5.0, sampleSize: 100, region: "IN" },
    { industry: "Education", objective: "lead_gen", channel: "META", cplMin: 50, cplMedian: 180, cplMax: 400, ctrMedian: 2.8, convMedian: 5.0, sampleSize: 180, region: "IN" }
  ];

  for (const r of rows) {
    await prisma.industryBenchmark.create({ data: r });
  }

  return { seeded: rows.length };
}