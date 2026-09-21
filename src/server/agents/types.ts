// Adziga — Agent tool registry
// Each Agent has a tool allowlist; this file enumerates the tools that
// any agent may declare. The runner consults this registry to validate
// tool calls and to dispatch them with the right permission scope.
//
// IMPORTANT: every tool that mutates state must check ctx.can() and refuse
// if the action isn't in the agent's permission list. The runner passes a
// permission context constructed from `agent.permissions`.

import type { PrismaClient } from "@prisma/client";

export type ToolContext = {
  prisma: PrismaClient;
  orgId: string;
  agentId: string;
  /** Check if the agent has a specific permission (e.g. "campaign.create") */
  can: (permission: string) => boolean;
  /** Who invoked this run (the user that triggered the chat, or "system" for cron) */
  invokedBy: string;
  /** Optional: act-as-orgId if Adziga team is operating on a client's org */
  actAsOrgId?: string;
  /** Optional client scope */
  clientId?: string;
};

export type ToolResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
  /** When true, the runner should persist a human-readable summary to the parent AgentAction */
  recordAction?: {
    type: string;
    summary: string;
    payload?: unknown;
  };
};

export type ToolHandler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON schema for input. We accept a loose shape for now and Zod-validate per tool. */
  inputSchema: Record<string, unknown>;
  /** Required permission to invoke this tool. The runner refuses if the agent lacks it. */
  requires: string;
  handler: ToolHandler;
};

// ──────────────────────────────────────────────────────────────────────────
// Campaign & budget tools (Ad Ops)
// ──────────────────────────────────────────────────────────────────────────

export const clientTools: ToolSpec[] = [
  {
    name: "client.create",
    description: "Create a new client record for a brand you onboard into Adziga. Auto-suggests a slug from the business name.",
    inputSchema: {
      type: "object",
      properties: {
        businessName: { type: "string" },
        contactName: { type: "string" },
        contactEmail: { type: "string" },
        contactPhone: { type: "string" },
        industry: { type: "string" },
        websiteUrl: { type: "string" },
        city: { type: "string" },
        monthlyBudget: { type: "number" }
      },
      required: ["businessName", "contactName", "contactEmail"]
    },
    requires: "client.create",
    handler: async (input, ctx) => {
      if (!ctx.can("client.create")) {
        return { ok: false, error: "permission denied: client.create" };
      }
      const businessName = String(input.businessName);
      const client = await ctx.prisma.client.create({
        data: {
          orgId: ctx.orgId,
          businessName,
          contactName: String(input.contactName),
          contactEmail: String(input.contactEmail),
          contactPhone: input.contactPhone ? String(input.contactPhone) : null,
          industry: input.industry ? String(input.industry) : null,
          websiteUrl: input.websiteUrl ? String(input.websiteUrl) : null,
          city: input.city ? String(input.city) : null,
          monthlyBudget: input.monthlyBudget ? Number(input.monthlyBudget) : null,
          status: "ACTIVE"
        }
      });
      return {
        ok: true,
        output: { clientId: client.id, businessName: client.businessName },
        recordAction: {
          type: "client.create",
          summary: `Onboarded client "${client.businessName}"`,
          payload: { clientId: client.id, businessName: client.businessName }
        }
      };
    }
  }
];

export const campaignTools: ToolSpec[] = [
  {
    name: "campaign.create",
    description: "Create a marketing campaign on a specific platform. Sets up the campaign row and (if integrations are configured) creates it on Meta/Google/etc.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        name: { type: "string" },
        platform: { type: "string", enum: ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "EVENT", "LINKEDIN", "YOUTUBE", "INSTAGRAM", "TWITTER"] },
        objective: { type: "string" },
        budget: { type: "number" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        notes: { type: "string" }
      },
      required: ["clientId", "name", "platform", "objective", "budget"]
    },
    requires: "campaign.create",
    handler: async (input, ctx) => {
      if (!ctx.can("campaign.create")) {
        return { ok: false, error: "permission denied: campaign.create" };
      }
      // Verify the client belongs to this org — refuse cross-org access
      const clientId = String(input.clientId);
      const client = await ctx.prisma.client.findFirst({
        where: { id: clientId, orgId: ctx.orgId },
        select: { id: true }
      });
      if (!client) {
        return { ok: false, error: `client ${clientId} not found in this org` };
      }
      const c = await ctx.prisma.campaign.create({
        data: {
          orgId: ctx.orgId,
          clientId,
          name: String(input.name),
          platform: String(input.platform),
          objective: String(input.objective),
          budget: Number(input.budget),
          startDate: input.startDate ? new Date(String(input.startDate)) : new Date(),
          endDate: input.endDate ? new Date(String(input.endDate)) : null,
          notes: input.notes ? String(input.notes) : null,
          status: "DRAFT"
        }
      });
      return {
        ok: true,
        output: { campaignId: c.id, name: c.name, status: c.status },
        recordAction: {
          type: "campaign.create",
          summary: `Created campaign "${c.name}" on ${c.platform} for ${(c.budget ?? 0).toLocaleString("en-IN")} INR`,
          payload: { campaignId: c.id, name: c.name, platform: c.platform, budget: c.budget }
        }
      };
    }
  },
  {
    name: "campaign.update",
    description: "Update an existing campaign's fields (budget, status, audience, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        budget: { type: "number" },
        status: { type: "string", enum: ["DRAFT", "INTERNAL_REVIEW", "CLIENT_APPROVAL", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] },
        audience: { type: "object" },
        notes: { type: "string" }
      },
      required: ["campaignId"]
    },
    requires: "campaign.update",
    handler: async (input, ctx) => {
      if (!ctx.can("campaign.update")) {
        return { ok: false, error: "permission denied: campaign.update" };
      }
      const data: any = {};
      if (input.budget !== undefined) data.budget = Number(input.budget);
      if (input.status !== undefined) data.status = String(input.status);
      if (input.audience !== undefined) data.audience = JSON.stringify(input.audience);
      if (input.notes !== undefined) data.notes = String(input.notes);
      const c = await ctx.prisma.campaign.update({
        where: { id: String(input.campaignId) },
        data
      });
      return {
        ok: true,
        output: { campaignId: c.id, status: c.status, budget: c.budget },
        recordAction: {
          type: "campaign.update",
          summary: `Updated campaign "${c.name}": ${Object.keys(data).join(", ")}`,
          payload: { campaignId: c.id, ...data }
        }
      };
    }
  },
  {
    name: "campaign.pause",
    description: "Pause a running campaign.",
    inputSchema: {
      type: "object",
      properties: { campaignId: { type: "string" }, reason: { type: "string" } },
      required: ["campaignId"]
    },
    requires: "campaign.pause",
    handler: async (input, ctx) => {
      if (!ctx.can("campaign.pause")) {
        return { ok: false, error: "permission denied: campaign.pause" };
      }
      const c = await ctx.prisma.campaign.update({
        where: { id: String(input.campaignId) },
        data: { status: "PAUSED" }
      });
      return {
        ok: true,
        output: { campaignId: c.id, status: c.status },
        recordAction: {
          type: "campaign.pause",
          summary: `Paused campaign "${c.name}"${input.reason ? `: ${String(input.reason)}` : ""}`,
          payload: { campaignId: c.id, reason: input.reason }
        }
      };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Budget allocation tools (Strategy)
// ──────────────────────────────────────────────────────────────────────────

export const budgetTools: ToolSpec[] = [
  {
    name: "budget.allocate",
    description: "Compute a recommended budget allocation across channels using Thompson sampling. Returns allocation but does NOT create campaigns (call campaign.create to materialize).",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        totalBudget: { type: "number" },
        days: { type: "number", default: 30 }
      },
      required: ["totalBudget"]
    },
    requires: "budget.read",
    handler: async (input, ctx) => {
      const { optimizeBudgetForOrg } = await import("@/lib/analytics/index");
      const result = await optimizeBudgetForOrg(ctx.orgId, Number(input.totalBudget), Number(input.days ?? 30));
      return { ok: true, output: result };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Creative & content tools
// ──────────────────────────────────────────────────────────────────────────

export const creativeTools: ToolSpec[] = [
  {
    name: "creative.create",
    description: "Create a creative (image, video, copy) and optionally link it to a campaign.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        name: { type: "string" },
        format: { type: "string", enum: ["IMAGE", "VIDEO", "CAROUSEL", "TEXT"] },
        platform: { type: "string" },
        hook: { type: "string" },
        headline: { type: "string" },
        primaryCopy: { type: "string" },
        cta: { type: "string" },
        audience: { type: "object" },
        mediaUrl: { type: "string" },
        thumbnailUrl: { type: "string" }
      },
      required: ["name", "format", "platform"]
    },
    requires: "creative.create",
    handler: async (input, ctx) => {
      if (!ctx.can("creative.create")) {
        return { ok: false, error: "permission denied: creative.create" };
      }
      const cr = await ctx.prisma.creative.create({
        data: {
          orgId: ctx.orgId,
          campaignId: input.campaignId ? String(input.campaignId) : null,
          name: String(input.name),
          format: String(input.format),
          platform: String(input.platform),
          hook: input.hook ? String(input.hook) : null,
          headline: input.headline ? String(input.headline) : null,
          primaryCopy: input.primaryCopy ? String(input.primaryCopy) : null,
          cta: input.cta ? String(input.cta) : null,
          audience: input.audience ? JSON.stringify(input.audience) : null,
          mediaUrl: input.mediaUrl ? String(input.mediaUrl) : null,
          thumbnailUrl: input.thumbnailUrl ? String(input.thumbnailUrl) : null
        }
      });
      return {
        ok: true,
        output: { creativeId: cr.id, name: cr.name },
        recordAction: {
          type: "creative.create",
          summary: `Created creative "${cr.name}"`,
          payload: { creativeId: cr.id }
        }
      };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Lead management tools
// ──────────────────────────────────────────────────────────────────────────

export const leadTools: ToolSpec[] = [
  {
    name: "lead.score",
    description: "Run predictive lead scoring on recent unscored leads.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        limit: { type: "number", default: 50 }
      }
    },
    requires: "lead.score",
    handler: async (input, ctx) => {
      if (!ctx.can("lead.score")) {
        return { ok: false, error: "permission denied: lead.score" };
      }
      const { scoreAllLeadsForOrg } = await import("@/lib/analytics/index");
      const scores = await scoreAllLeadsForOrg(ctx.orgId, Number(input.limit ?? 50));
      return { ok: true, output: { scored: scores.length, sample: scores.slice(0, 5) } };
    }
  },
  {
    name: "lead.assign",
    description: "Assign a lead to a sales rep (set ownerId).",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
        ownerId: { type: "string" }
      },
      required: ["leadId", "ownerId"]
    },
    requires: "lead.assign",
    handler: async (input, ctx) => {
      if (!ctx.can("lead.assign")) {
        return { ok: false, error: "permission denied: lead.assign" };
      }
      const l = await ctx.prisma.lead.update({
        where: { id: String(input.leadId) },
        data: { ownerId: String(input.ownerId) }
      });
      return { ok: true, output: { leadId: l.id, ownerId: l.ownerId } };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Reporting & analytics tools
// ──────────────────────────────────────────────────────────────────────────

export const reportTools: ToolSpec[] = [
  {
    name: "analytics.mmm",
    description: "Run Marketing Mix Modeling for the org. Returns channel ROI and recommended reallocation.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", default: 90 } }
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      const { runMMMForOrg } = await import("@/lib/analytics/index");
      const result = await runMMMForOrg(ctx.orgId, Number(input.days ?? 90));
      return { ok: true, output: result };
    }
  },
  {
    name: "analytics.attribution",
    description: "Run multi-touch attribution (Shapley values) over recent leads.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", default: 90 } }
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      const leads = await ctx.prisma.lead.findMany({
        where: { orgId: ctx.orgId, createdAt: { gte: new Date(Date.now() - Number(input.days ?? 90) * 86400_000) } },
        take: 200,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, source: true, campaignId: true, createdAt: true, updatedAt: true }
      });
      const { computeAttributionBatch } = await import("@/lib/analytics/index");
      const inputs = leads.map((l) => ({
        leadId: l.id,
        touchpoints: [
          { channel: ((l.source || "OTHER").toUpperCase()) as any, occurredAt: l.createdAt.toISOString() },
          ...(l.updatedAt.getTime() - l.createdAt.getTime() > 60_000
            ? [{ channel: "DIRECT" as any, occurredAt: l.updatedAt.toISOString() }]
            : [])
        ],
        converted: l.status === "WON"
      }));
      const results = await computeAttributionBatch(inputs);
      const totals: Record<string, number> = {};
      for (const r of results) {
        for (const [ch, c] of Object.entries(r.channelCredits as Record<string, number>)) {
          totals[ch] = (totals[ch] ?? 0) + c;
        }
      }
      return { ok: true, output: { leadsAnalyzed: results.length, channelTotals: totals } };
    }
  },
  {
    name: "analytics.anomalies",
    description: "Detect anomalies in marketing metrics (spend, leads, CPL, ROAS, CTR).",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", default: 30 } }
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      const { detectOrgAnomalies } = await import("@/lib/analytics/index");
      const result = await detectOrgAnomalies(ctx.orgId, Number(input.days ?? 30));
      return { ok: true, output: result };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Competitor intelligence tools
// ──────────────────────────────────────────────────────────────────────────

export const competitorTools: ToolSpec[] = [
  {
    name: "competitor.recordAd",
    description: "Store a competitor's ad snapshot (typically from Meta Ad Library) for tracking.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        competitorName: { type: "string" },
        externalId: { type: "string" },
        pageName: { type: "string" },
        landingUrl: { type: "string" },
        spendBucket: { type: "string" },
        impressionsBucket: { type: "string" },
        reachEstimate: { type: "number" },
        activeDays: { type: "number" },
        snapshot: { type: "object" }
      },
      required: ["competitorName"]
    },
    requires: "competitor.write",
    handler: async (input, ctx) => {
      if (!ctx.can("competitor.write")) {
        return { ok: false, error: "permission denied: competitor.write" };
      }
      const ad = await ctx.prisma.competitorAd.create({
        data: {
          orgId: ctx.orgId,
          clientId: input.clientId ? String(input.clientId) : null,
          competitorName: String(input.competitorName),
          externalId: input.externalId ? String(input.externalId) : null,
          pageName: input.pageName ? String(input.pageName) : null,
          landingUrl: input.landingUrl ? String(input.landingUrl) : null,
          spendBucket: input.spendBucket ? String(input.spendBucket) : null,
          impressionsBucket: input.impressionsBucket ? String(input.impressionsBucket) : null,
          reachEstimate: input.reachEstimate ? Number(input.reachEstimate) : null,
          activeDays: input.activeDays ? Number(input.activeDays) : null,
          snapshot: input.snapshot ? JSON.stringify(input.snapshot) : null,
          status: "active"
        }
      });
      return { ok: true, output: { adId: ad.id } };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// All tools registry
// ──────────────────────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolSpec[] = [
  ...clientTools,
  ...campaignTools,
  ...budgetTools,
  ...creativeTools,
  ...leadTools,
  ...reportTools,
  ...competitorTools
];

export const TOOL_BY_NAME: Record<string, ToolSpec> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t])
);

export function toolsForAgent(allowlist: string): ToolSpec[] {
  if (!allowlist || !allowlist.trim()) return [];
  const allowed = new Set(allowlist.split(",").map((s) => s.trim()).filter(Boolean));
  return ALL_TOOLS.filter((t) => allowed.has(t.requires));
}
