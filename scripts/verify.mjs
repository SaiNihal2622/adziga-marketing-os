import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const main = async () => {
  const stats = {
    plans: await p.orchestrationPlan.count(),
    planCampaigns: await p.planCampaign.count(),
    deployedCampaigns: await p.planCampaign.count({ where: { status: "DEPLOYED" } }),
    strategies: await p.strategyRecommendation.count(),
    contentPatterns: await p.contentPattern.count(),
    benchmarks: await p.industryBenchmark.count(),
    workflowRuns: await p.workflowRun.count(),
    leadScores: await p.leadScore.count(),
    backgroundJobs: await p.backgroundJob.count(),
    // all campaigns including auto-deployed
    campaigns: await p.campaign.count()
  };
  console.log(stats);

  // Show one orchestration plan
  const plan = await p.orchestrationPlan.findFirst({
    include: { campaigns: true },
    orderBy: { createdAt: "desc" }
  });
  if (plan) {
    console.log("\nLatest orchestration plan:");
    console.log(`  goal: ${plan.goalType} ${plan.goalQuantity} ${plan.goalMetric}`);
    console.log(`  status: ${plan.status}`);
    console.log(`  budget: ₹${plan.estimatedCost}`);
    console.log(`  expected: CPL ₹${plan.estimatedCpl}, CAC ₹${plan.estimatedCac}, ROAS ${plan.expectedRoas}x`);
    console.log(`  confidence: ${(plan.confidence * 100).toFixed(0)}%`);
    console.log(`  campaigns (${plan.campaigns.length}):`);
    for (const c of plan.campaigns) {
      console.log(`    - ${c.name} [${c.platform}] budget=₹${c.budget} expected_leads=${c.expectedLeads} status=${c.status}`);
    }
  }
};
main().catch(e => console.error(e)).finally(() => p.$disconnect());