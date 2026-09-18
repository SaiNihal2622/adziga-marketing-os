// Background job scheduler - Phase 1 orchestrator
// Runs:
//   1) Automation ticks (every N minutes)
//   2) Campaign health check (hourly)
//   3) Intelligence recompute (daily)
//   4) Integration health check (hourly)
//   5) Lead auto-scoring (on-demand from events)

import { prisma } from "../db";
import { fire, checkCampaignHealth, scoreLead } from "./lead-router";
import { recomputeContentPatterns } from "./content-engine";
import { seedBenchmarks, recommendStrategy } from "./strategy-engine";

export async function tickAutomation() {
  const orgs = await prisma.organization.findMany({ where: { isAdzigaInternal: true }, take: 1 });
  for (const org of orgs) {
    // Fire scheduled events
    const recentLeads = await prisma.lead.findMany({
      where: { orgId: org.id, createdAt: { gte: new Date(Date.now() - 600_000) } },
      take: 100
    });

    for (const l of recentLeads) {
      // Auto-score leads that haven't been scored yet
      const existing = await prisma.leadScore.findUnique({ where: { leadId: l.id } });
      if (!existing) {
        await fire({
          trigger: "lead.created",
          orgId: org.id,
          entityType: "Lead",
          entityId: l.id,
          payload: {
            leadId: l.id,
            source: l.source,
            city: l.city,
            email: l.email,
            phone: l.phone,
            campaignId: l.campaignId
          }
        });
      }
    }
  }
}

export async function tickCampaignHealth() {
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    await checkCampaignHealth(org.id);
  }
}

export async function tickIntelligenceRecompute() {
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    await recomputeContentPatterns(org.id);
    await seedBenchmarks();
  }
}

export async function tickIntegrationHealth() {
  const integrations = await prisma.integration.findMany();
  for (const i of integrations) {
    // Stub: rotate status
    const rand = Math.random();
    let newStatus = "HEALTHY";
    if (rand < 0.05) newStatus = "DEGRADED";
    else if (rand < 0.01) newStatus = "FAILED";
    await prisma.integration.update({
      where: { id: i.id },
      data: { status: newStatus, lastSyncAt: new Date() }
    });
  }
}

export async function runScheduledJob(name: string): Promise<{ ok: boolean; result?: any; error?: string }> {
  const job = await prisma.backgroundJob.create({
    data: { name, status: "RUNNING", startedAt: new Date() }
  });

  const start = Date.now();
  try {
    let result: any;
    if (name === "automations.tick") result = await tickAutomation();
    else if (name === "campaign.health_check") result = await tickCampaignHealth();
    else if (name === "intelligence.recompute") result = await tickIntelligenceRecompute();
    else if (name === "integration.health_check") result = await tickIntegrationHealth();
    else throw new Error(`unknown job: ${name}`);

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        durationMs: Date.now() - start,
        result: JSON.stringify(result ?? {})
      }
    });
    return { ok: true, result };
  } catch (e: any) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs: Date.now() - start,
        error: e.message
      }
    });
    return { ok: false, error: e.message };
  }
}