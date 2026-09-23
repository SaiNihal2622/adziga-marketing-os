// Adziga — AgentCostAlertService (Sprint 18c)
// Tracks per-org LLM spend and flags when daily or weekly cost
// exceeds a configured threshold. Uses the same pattern as
// webhook-health (alerts stored in Organization.metadata.alerts
// with category=agent_cost).
//
// Cost formula matches the Admin/Agents page:
//   costPerToken = 0.0005  (₹0.50 per 1K blended tokens,
//                            60% input / 40% output blended avg)

import { prisma } from "@/lib/db";

export type AgentCostAlert = {
  id: string;            // e.g. "agent_cost:daily:2026-09-23"
  severity: "warning" | "critical";
  category: "agent_cost";
  message: string;
  metric: "daily_cost" | "weekly_cost";
  threshold: number;
  observed: number;
  raisedAt: string;
};

export type AgentCostSnapshot = {
  windowDays: number;
  today: { tokens: number; cost: number };
  week: { tokens: number; cost: number };
  window: { tokens: number; cost: number };
  thresholds: { dailyLimit: number; weeklyLimit: number };
  alerts: AgentCostAlert[];
  computedAt: string;
};

export type AgentCostPolicy = {
  dailyLimit: number;    // ₹ — raise "warning" when crossed
  weeklyLimit: number;
  enabled: boolean;
};

export const DEFAULT_POLICY: AgentCostPolicy = {
  dailyLimit: 200,       // ₹200/day
  weeklyLimit: 1000,
  enabled: true
};

const COST_PER_TOKEN = 0.0005;
const ALERT_KEY = "agentCostAlerts";
const POLICY_KEY = "agentCostPolicy";

function safeJsonParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadPolicy(orgId: string): Promise<AgentCostPolicy> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  const p = (meta[POLICY_KEY] ?? {}) as Partial<AgentCostPolicy>;
  return { ...DEFAULT_POLICY, ...p };
}

async function savePolicy(orgId: string, policy: AgentCostPolicy): Promise<void> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  await prisma.organization.update({
    where: { id: orgId },
    data: { metadata: JSON.stringify({ ...meta, [POLICY_KEY]: policy }) }
  });
}

async function loadStoredAlerts(orgId: string): Promise<AgentCostAlert[]> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  const list = meta[ALERT_KEY];
  return Array.isArray(list) ? (list as AgentCostAlert[]) : [];
}

async function saveStoredAlerts(orgId: string, alerts: AgentCostAlert[]): Promise<void> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  await prisma.organization.update({
    where: { id: orgId },
    data: { metadata: JSON.stringify({ ...meta, [ALERT_KEY]: alerts }) }
  });
}

export const AgentCostAlertService = {
  async getPolicy(orgId: string): Promise<AgentCostPolicy> {
    return loadPolicy(orgId);
  },

  async updatePolicy(orgId: string, patch: Partial<AgentCostPolicy>): Promise<AgentCostPolicy> {
    const current = await loadPolicy(orgId);
    const merged: AgentCostPolicy = {
      ...current,
      ...patch,
      dailyLimit: Math.max(0, Number(patch.dailyLimit ?? current.dailyLimit)),
      weeklyLimit: Math.max(0, Number(patch.weeklyLimit ?? current.weeklyLimit))
    };
    await savePolicy(orgId, merged);
    return merged;
  },

  /**
   * Pure read — compute today's / this week's / window's cost without
   * raising alerts.
   */
  async snapshot(orgId: string, windowDays: number = 7): Promise<AgentCostSnapshot> {
    const policy = await loadPolicy(orgId);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
    const winStart = new Date(Date.now() - windowDays * 86_400_000);

    const [todayAgg, weekAgg, winAgg] = await Promise.all([
      prisma.agentRun.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: { orgId, startedAt: { gte: todayStart } }
      }),
      prisma.agentRun.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: { orgId, startedAt: { gte: weekStart } }
      }),
      prisma.agentRun.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: { orgId, startedAt: { gte: winStart } }
      })
    ]);

    const sumTokens = (a: { _sum: { tokensIn: number | null; tokensOut: number | null } }) =>
      (a._sum.tokensIn ?? 0) + (a._sum.tokensOut ?? 0);

    const today = {
      tokens: sumTokens(todayAgg),
      cost: Number((sumTokens(todayAgg) * COST_PER_TOKEN).toFixed(2))
    };
    const week = {
      tokens: sumTokens(weekAgg),
      cost: Number((sumTokens(weekAgg) * COST_PER_TOKEN).toFixed(2))
    };
    const win = {
      tokens: sumTokens(winAgg),
      cost: Number((sumTokens(winAgg) * COST_PER_TOKEN).toFixed(2))
    };

    const alerts: AgentCostAlert[] = [];
    const nowIso = new Date().toISOString();
    if (policy.enabled) {
      if (today.cost > policy.dailyLimit) {
        alerts.push({
          id: `agent_cost:daily:${todayKey()}`,
          severity: today.cost > policy.dailyLimit * 1.5 ? "critical" : "warning",
          category: "agent_cost",
          message: `Today's LLM cost ₹${today.cost.toFixed(0)} exceeded the daily limit of ₹${policy.dailyLimit.toFixed(0)}`,
          metric: "daily_cost",
          threshold: policy.dailyLimit,
          observed: today.cost,
          raisedAt: nowIso
        });
      }
      if (week.cost > policy.weeklyLimit) {
        alerts.push({
          id: `agent_cost:weekly:${todayKey()}`,
          severity: week.cost > policy.weeklyLimit * 1.5 ? "critical" : "warning",
          category: "agent_cost",
          message: `This week's LLM cost ₹${week.cost.toFixed(0)} exceeded the weekly limit of ₹${policy.weeklyLimit.toFixed(0)}`,
          metric: "weekly_cost",
          threshold: policy.weeklyLimit,
          observed: week.cost,
          raisedAt: nowIso
        });
      }
    }

    return {
      windowDays,
      today,
      week,
      window: win,
      thresholds: { dailyLimit: policy.dailyLimit, weeklyLimit: policy.weeklyLimit },
      alerts,
      computedAt: nowIso
    };
  },

  /**
   * Run snapshot + persist raised alerts (merge with stored).
   */
  async check(orgId: string): Promise<AgentCostSnapshot> {
    const snap = await this.snapshot(orgId);
    const stored = await loadStoredAlerts(orgId);
    const seen = new Set(snap.alerts.map((a) => a.id));
    // Drop stale stored alerts; keep the new ones; cap to last 50.
    const kept = stored.filter((a) => !seen.has(a.id));
    const merged: AgentCostAlert[] = [...snap.alerts, ...kept].slice(0, 50);
    await saveStoredAlerts(orgId, merged);

    return snap;
  },

  async getStoredAlerts(orgId: string): Promise<AgentCostAlert[]> {
    return loadStoredAlerts(orgId);
  }
};
