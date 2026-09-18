// Adziga Marketing Orchestration - Phase 4
// Per spec ??10 - USER describes objective  ADZIGA creates plan  recommends budget
//    creates campaigns  generates creatives  REQUEST APPROVAL  Deploy  Monitor  Optimize  Report  Learn
// The human remains in control through configurable approval policies (spec ??0, ??29).

import { prisma } from "../db";
import { recommendStrategy } from "./strategy-engine";
import { suggestCreative } from "./content-engine";

export type OrchestrationGoal = {
  orgId: string;
  clientId?: string;
  authorId: string;
  goalType: "lead_gen" | "awareness" | "conversion" | "revenue";
  goalQuantity: number;
  goalMetric: string; // "qualified_leads" | "impressions" | "customers" | "revenue_inr"
  goalDeadline: Date;
  goalNotes?: string;
};

export type OrchestrationPlanOutput = {
  planId: string;
  budget: {
    totalMonthly: number;
    split: Array<{ channel: string; amount: number; pct: number }>;
  };
  timeline: {
    startDate: string;
    endDate: string;
    durationDays: number;
  };
  campaigns: Array<{
    name: string;
    platform: string;
    objective: string;
    budget: number;
    durationDays: number;
    audience: any;
    creativeBrief: any;
    expectedCpl: number;
    expectedLeads: number;
  }>;
  estimated: {
    cost: number;
    cpl: number;
    cac: number;
    roas: number;
  };
  confidence: number;
  reasoning: any;
};

/**
 * Generate a complete orchestration plan from a business goal.
 * Returns plan with channels, campaigns, creative briefs, and projected outcomes.
 */
export async function generateOrchestrationPlan(goal: OrchestrationGoal): Promise<OrchestrationPlanOutput> {
  // 1) Get client context
  let client: any = null;
  if (goal.clientId) {
    client = await prisma.client.findUnique({ where: { id: goal.clientId } });
  }

  const industry = client?.industry ?? "Other";
  const audience = "general";

  // 2) Estimate required monthly budget to hit the goal
  // Rough formula: monthly_budget = goalQuantity * expectedCpl
  // Use a conservative CPL of 600 if we don't know better
  const roughCpl = goal.goalType === "lead_gen" ? 600 : goal.goalType === "conversion" ? 1500 : goal.goalType === "revenue" ? 2000 : 100;
  const monthlyBudget = Math.max(goal.goalQuantity * roughCpl, 50000);

  // 3) Get strategy recommendation
  const strategy = await recommendStrategy({
    orgId: goal.orgId,
    clientId: goal.clientId,
    industry,
    objective: goal.goalType,
    monthlyBudget,
    region: "IN",
    audience: { tier: "tier-1" }
  });

  // 4) Generate creative briefs per channel using content intelligence
  const campaignPlans: any[] = [];
  for (const ch of strategy.channels) {
    const creativeSuggestion = await suggestCreative(goal.orgId, {
      industry,
      audience,
      platform: ch.platform,
      goal: goal.goalType as any
    });

    const channelBudget = Math.round(monthlyBudget * (ch.allocationPct / 100));
    const durationDays = Math.min(90, Math.max(14, Math.round((goal.goalDeadline.getTime() - Date.now()) / 86400_000)));
    const expectedLeads = ch.expectedCpl > 0 ? Math.round(channelBudget / ch.expectedCpl) : 0;

    campaignPlans.push({
      name: `${client?.businessName ?? "Adziga"} - ${ch.platform} ${goal.goalType}`,
      platform: ch.platform,
      objective: goal.goalType,
      budget: channelBudget,
      durationDays,
      audience: {
        industry,
        tier1Cities: true,
        b2b_b2c: client?.businessModel ?? "B2C"
      },
      creativeBrief: {
        format: creativeSuggestion.recommendedFormat,
        hookPattern: creativeSuggestion.recommendedHookPattern,
        ctaPattern: creativeSuggestion.recommendedCtaPattern,
        expectedCtr: creativeSuggestion.expectedCtr,
        rationale: creativeSuggestion.rationale
      },
      expectedCpl: ch.expectedCpl,
      expectedLeads
    });
  }

  // 5) Timeline
  const startDate = new Date();
  const endDate = goal.goalDeadline;
  const durationDays = Math.max(14, Math.round((endDate.getTime() - startDate.getTime()) / 86400_000));

  const planInput = {
    planId: "",
    budget: {
      totalMonthly: monthlyBudget,
      split: strategy.channels.map((c) => ({
        channel: c.channel,
        amount: Math.round(monthlyBudget * (c.allocationPct / 100)),
        pct: c.allocationPct
      }))
    },
    timeline: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      durationDays
    },
    campaigns: campaignPlans,
    estimated: {
      cost: monthlyBudget,
      cpl: strategy.expectedCpl,
      cac: strategy.expectedCac,
      roas: strategy.expectedRoas
    },
    confidence: strategy.confidence,
    reasoning: strategy.reasoning
  };

  // 6) Persist the plan
  const created = await prisma.orchestrationPlan.create({
    data: {
      orgId: goal.orgId,
      clientId: goal.clientId,
      authorId: goal.authorId,
      goalType: goal.goalType,
      goalQuantity: goal.goalQuantity,
      goalMetric: goal.goalMetric,
      goalDeadline: goal.goalDeadline,
      goalNotes: goal.goalNotes,
      strategy: JSON.stringify(planInput),
      estimatedCost: monthlyBudget,
      estimatedCpl: strategy.expectedCpl,
      estimatedCac: strategy.expectedCac,
      expectedRoas: strategy.expectedRoas,
      confidence: strategy.confidence,
      reasoning: JSON.stringify(strategy.reasoning),
      status: "DRAFT"
    }
  });

  // Persist each PlanCampaign
  for (let i = 0; i < campaignPlans.length; i++) {
    const c = campaignPlans[i];
    await prisma.planCampaign.create({
      data: {
        planId: created.id,
        name: c.name,
        platform: c.platform,
        objective: c.objective,
        budget: c.budget,
        durationDays: c.durationDays,
        audienceSpec: JSON.stringify(c.audience),
        creativeBrief: JSON.stringify(c.creativeBrief),
        expectedCpl: c.expectedCpl,
        expectedLeads: c.expectedLeads,
        order: i,
        status: "PENDING"
      }
    });
  }

  planInput.planId = created.id;
  return planInput;
}

/**
 * Move plan through approval workflow.
 */
export async function transitionPlan(planId: string, to: string, approverId?: string): Promise<void> {
  const plan = await prisma.orchestrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("plan not found");

  const data: any = { status: to };
  if (to === "CLIENT_APPROVAL" && approverId) data.internalReviewerId = approverId, data.internalReviewedAt = new Date();
  if (to === "APPROVED" && approverId) data.clientApproverId = approverId, data.clientApprovedAt = new Date();
  if (to === "EXECUTING") data.executedAt = new Date();
  if (to === "COMPLETED" || to === "FAILED") data.completedAt = new Date();

  await prisma.orchestrationPlan.update({ where: { id: planId }, data });

  // Audit
  await prisma.auditLog.create({
    data: {
      orgId: plan.orgId,
      action: `orchestration_plan.${to.toLowerCase()}`,
      entityType: "OrchestrationPlan",
      entityId: plan.id,
      after: JSON.stringify({ status: to, approverId })
    }
  });
}

/**
 * Deploy an approved plan - create real Campaign + Creative rows from the PlanCampaign entries.
 * This is the "EXECUTE" step (only allowed after APPROVED status).
 */
export async function deployPlan(planId: string): Promise<{ deployed: number; errors: string[] }> {
  const plan = await prisma.orchestrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("plan not found");
  if (plan.status !== "APPROVED") throw new Error(`Plan must be APPROVED (currently ${plan.status})`);

  const planCamps = await prisma.planCampaign.findMany({ where: { planId }, orderBy: { order: "asc" } });
  const errors: string[] = [];
  let deployed = 0;

  for (const pc of planCamps) {
    try {
      // Create the campaign
      const client = await prisma.client.findFirst({ where: { orgId: plan.orgId } });
      if (!client) {
        errors.push(`No client for plan ${planId}`);
        continue;
      }

      const camp = await prisma.campaign.create({
        data: {
          orgId: plan.orgId,
          clientId: client.id,
          name: pc.name,
          platform: pc.platform,
          objective: pc.objective,
          budget: pc.budget,
          startDate: new Date(),
          endDate: new Date(Date.now() + pc.durationDays * 86400_000),
          status: "DRAFT", // go through workflow; not auto-deployed
          health: "Healthy"
        }
      });

      // Create a starter creative per campaign
      const brief = JSON.parse(pc.creativeBrief);
      await prisma.creative.create({
        data: {
          orgId: plan.orgId,
          campaignId: camp.id,
          name: `${pc.name} - Auto-brief creative`,
          format: brief.format ?? "VIDEO",
          platform: pc.platform,
          hook: brief.hookPattern,
          cta: brief.ctaPattern,
          creator: "Adziga Orchestration",
          audience: brief.audience?.tier1Cities ? "Tier-1" : "All",
          status: "DRAFT"
        }
      });

      await prisma.planCampaign.update({
        where: { id: pc.id },
        data: { campaignId: camp.id, status: "DEPLOYED", deployedAt: new Date() }
      });

      deployed++;
    } catch (e: any) {
      errors.push(`${pc.name}: ${e.message}`);
    }
  }

  await transitionPlan(planId, "EXECUTING", plan.authorId);

  return { deployed, errors };
}