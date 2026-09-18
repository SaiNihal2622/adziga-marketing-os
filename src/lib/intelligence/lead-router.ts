// Adziga Automation Engine - Phase 1
// Workflow executor: trigger -> conditions -> actions
// Every automation is auditable via WorkflowRun.

import { prisma } from "../db";

export type TriggerEvent = {
  trigger: string;
  orgId: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, any>;
};

export type AutomationAction = {
  type: string;
  params?: Record<string, any>;
};

export async function fire(event: TriggerEvent): Promise<void> {
  const matching = await prisma.automation.findMany({
    where: { orgId: event.orgId, trigger: event.trigger, enabled: true }
  });

  for (const a of matching) {
    runAutomation(a.id, event).catch((e) => console.error("automation failed", a.id, e));
  }
}

async function runAutomation(automationId: string, event: TriggerEvent) {
  const start = Date.now();
  const steps: Array<{ at: string; action: string; ok: boolean; detail?: string }> = [];

  const a = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!a) return;

  // 1) Evaluate conditions
  let conditionsOk = true;
  try {
    const conditions = JSON.parse(a.conditions);
    if (Object.keys(conditions).length > 0) {
      // Basic field matcher
      for (const [k, v] of Object.entries(conditions)) {
        if (event.payload?.[k] !== v) {
          conditionsOk = false;
          steps.push({ at: new Date().toISOString(), action: "condition.check", ok: false, detail: `${k} != ${v}` });
          break;
        }
      }
      if (conditionsOk) steps.push({ at: new Date().toISOString(), action: "condition.check", ok: true });
    }
  } catch (e: any) {
    steps.push({ at: new Date().toISOString(), action: "condition.parse", ok: false, detail: e.message });
    conditionsOk = false;
  }

  if (!conditionsOk) {
    await prisma.workflowRun.create({
      data: {
        orgId: event.orgId,
        trigger: event.trigger,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: JSON.stringify(event.payload ?? {}),
        status: "success",
        log: JSON.stringify(steps),
        completedAt: new Date(),
        durationMs: Date.now() - start,
        automationId
      }
    });
    return;
  }

  // 2) Execute actions
  let actions: AutomationAction[] = [];
  try {
    actions = JSON.parse(a.actions);
  } catch (e: any) {
    steps.push({ at: new Date().toISOString(), action: "actions.parse", ok: false, detail: e.message });
  }

  for (const action of actions) {
    try {
      const result = await executeAction(event, action);
      steps.push({ at: new Date().toISOString(), action: action.type, ok: true, detail: result });
    } catch (e: any) {
      steps.push({ at: new Date().toISOString(), action: action.type, ok: false, detail: e.message });
    }
  }

  // 3) Increment run counter, last run
  await prisma.automation.update({
    where: { id: automationId },
    data: {
      runsCount: { increment: 1 },
      lastRunAt: new Date()
    }
  });

  await prisma.workflowRun.create({
    data: {
      orgId: event.orgId,
      trigger: event.trigger,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: JSON.stringify(event.payload ?? {}),
      status: steps.every((s) => s.ok) ? "success" : "failed",
      log: JSON.stringify(steps),
      completedAt: new Date(),
      durationMs: Date.now() - start,
      automationId
    }
  });
}

async function executeAction(event: TriggerEvent, action: AutomationAction): Promise<string> {
  switch (action.type) {
    case "lead.assign":
    case "set.assignee": {
      const leadId = event.entityId ?? event.payload?.leadId;
      if (!leadId) throw new Error("no leadId");
      const sourceMap: Record<string, string> = action.params?.source_to_user ?? {};
      const source = event.payload?.source ?? "DIRECT";
      const userEmail = sourceMap[source];
      let userId: string | null = null;
      if (userEmail) {
        const u = await prisma.user.findUnique({ where: { email: userEmail } });
        userId = u?.id ?? null;
      }
      await prisma.leadAssignment.upsert({
        where: { leadId },
        update: { assigneeId: userId, rule: `auto-source:${source}`, reason: `Source=${source}` },
        create: {
          orgId: event.orgId,
          leadId,
          assigneeId: userId,
          rule: `auto-source:${source}`,
          reason: `Source=${source}`
        }
      });
      if (userId) {
        await prisma.lead.update({ where: { id: leadId }, data: { ownerId: userId } }).catch(() => null);
      }
      return `assigned to ${userEmail ?? "unassigned"}`;
    }

    case "lead.score": {
      const leadId = event.entityId ?? event.payload?.leadId;
      if (!leadId) throw new Error("no leadId");
      const score = scoreLead(event.payload ?? {});
      await prisma.leadScore.upsert({
        where: { leadId },
        update: { score, factors: JSON.stringify(event.payload ?? {}), computedAt: new Date() },
        create: { orgId: event.orgId, leadId, score, factors: JSON.stringify(event.payload ?? {}) }
      });
      await prisma.lead.update({ where: { id: leadId }, data: { score } }).catch(() => null);
      return `score=${score}`;
    }

    case "notify.user":
    case "notify": {
      const userId = action.params?.userId ?? event.payload?.userId;
      if (!userId) throw new Error("no userId");
      await prisma.notification.create({
        data: {
          orgId: event.orgId,
          userId,
          type: event.trigger,
          title: action.params?.title ?? `${event.trigger} fired`,
          message: action.params?.message ?? JSON.stringify(event.payload ?? {}).slice(0, 200),
          link: action.params?.link,
          channel: "in-app"
        }
      });
      return `notified ${userId}`;
    }

    case "campaign.pause": {
      const campaignId = event.entityId ?? event.payload?.campaignId;
      if (!campaignId) throw new Error("no campaignId");
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
      return `paused ${campaignId}`;
    }

    case "campaign.flag_at_risk": {
      const campaignId = event.entityId ?? event.payload?.campaignId;
      if (!campaignId) throw new Error("no campaignId");
      await prisma.campaign.update({ where: { id: campaignId }, data: { health: "At Risk" } });
      return `flagged ${campaignId}`;
    }

    case "report.publish_notification": {
      // sends notification to all client users of the report's org
      const reportId = event.entityId ?? event.payload?.reportId;
      if (!reportId) throw new Error("no reportId");
      const r = await prisma.report.findUnique({ where: { id: reportId } });
      if (!r) throw new Error("report not found");
      const members = await prisma.user.findMany({ where: { memberships: { some: { orgId: r.clientId } } } });
      for (const m of members) {
        await prisma.notification.create({
          data: {
            orgId: r.orgId,
            userId: m.id,
            type: "report.published",
            title: `New report: ${r.title}`,
            message: "Your latest performance report has been published.",
            link: `/app/reports/${r.id}`,
            channel: "in-app"
          }
        });
      }
      return `notified ${members.length} client users`;
    }

    case "whatsapp.send": {
      // Stub - would dispatch to WhatsApp Business API
      const leadId = event.payload?.leadId;
      console.log(`[WHATSAPP STUB] to lead ${leadId}: ${action.params?.template ?? "hello"}`);
      return "queued (stub)";
    }

    case "email.send": {
      // Stub - would dispatch via SMTP/SendGrid
      const to = action.params?.to ?? event.payload?.email;
      console.log(`[EMAIL STUB] to ${to}: ${action.params?.template ?? "default"}`);
      return "queued (stub)";
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// Phase 1 - Lead Scoring (deterministic rules)
// Returns 0-100 score based on signals.
export function scoreLead(payload: Record<string, any>): number {
  let score = 0;
  const factors: Array<{ k: string; v: number; reason: string }> = [];

  // Source quality (Meta/Google paid > organic > direct)
  const source = payload.source;
  if (source === "META_AD" || source === "GOOGLE_AD") {
    score += 25; factors.push({ k: "source", v: 25, reason: "Paid acquisition source" });
  } else if (source === "INFLUENCER" || source === "EVENT") {
    score += 30; factors.push({ k: "source", v: 30, reason: "High-trust source (influencer/event)" });
  } else if (source === "ORGANIC" || source === "REFERRAL") {
    score += 20; factors.push({ k: "source", v: 20, reason: "Warm source" });
  } else if (source === "WHATSAPP" || source === "DIRECT") {
    score += 15; factors.push({ k: "source", v: 15, reason: "Direct inquiry" });
  } else {
    score += 10; factors.push({ k: "source", v: 10, reason: "Unknown source" });
  }

  // Tier-1 city bonus
  const city = (payload.city ?? "").toString().toLowerCase();
  const tier1 = ["mumbai", "delhi", "bengaluru", "bangalore", "hyderabad", "pune", "chennai"];
  if (tier1.includes(city)) {
    score += 15; factors.push({ k: "city", v: 15, reason: "Tier-1 city" });
  }

  // Campaign involvement (recent campaign = higher intent)
  if (payload.campaignId) {
    score += 10; factors.push({ k: "campaign", v: 10, reason: "From active campaign" });
  }

  // Contact completeness
  if (payload.email) { score += 8; factors.push({ k: "email", v: 8, reason: "Email provided" }); }
  if (payload.phone) { score += 12; factors.push({ k: "phone", v: 12, reason: "Phone provided" }); }

  // Cap at 100
  return Math.min(100, score);
}

// Phase 1 - Campaign Health Monitor (background job)
export async function checkCampaignHealth(orgId: string): Promise<{ flagged: number; alerts: any[] }> {
  const campaigns = await prisma.campaign.findMany({
    where: { orgId, status: "ACTIVE" }
  });

  const alerts: any[] = [];
  for (const c of campaigns) {
    // Over budget
    if (c.budget && c.spent / c.budget > 0.95 && c.spent / c.budget <= 1.1) {
      alerts.push({ campaignId: c.id, name: c.name, kind: "over_budget", severity: "warning", detail: `${(c.spent / c.budget * 100).toFixed(0)}% of budget used` });
    }
    // Critical over budget - auto-pause candidate
    if (c.budget && c.spent / c.budget > 1.1) {
      await prisma.campaign.update({ where: { id: c.id }, data: { health: "Critical" } });
      alerts.push({ campaignId: c.id, name: c.name, kind: "critical_over_budget", severity: "critical", detail: `${(c.spent / c.budget * 100).toFixed(0)}% of budget used` });
    }
    // CPL spike: compare to org median
    const orgCampaigns = campaigns.filter((x) => x.platform === c.platform && Number(x.leads) > 0);
    const cpls = orgCampaigns.map((x) => x.spent / Number(x.leads)).filter((v) => isFinite(v) && v > 0);
    if (cpls.length >= 3) {
      const sorted = cpls.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const myCpl = Number(c.leads) > 0 ? c.spent / Number(c.leads) : 0;
      if (myCpl > median * 2 && myCpl > 0) {
        await prisma.campaign.update({ where: { id: c.id }, data: { health: "At Risk" } }).catch(() => null);
        alerts.push({ campaignId: c.id, name: c.name, kind: "cpl_spike", severity: "warning", detail: `CPL ${myCpl.toFixed(0)} > 2x platform median ${median.toFixed(0)}` });
      }
    }
  }

  for (const a of alerts) {
    if (a.severity === "critical") {
      await fire({
        trigger: "campaign.spend_threshold",
        orgId,
        entityType: "Campaign",
        entityId: a.campaignId,
        payload: a
      });
    }
  }

  return { flagged: alerts.length, alerts };
}