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
  /** The userId that started the run — used by tools that need to attribute changes (approvals etc.) */
  userId?: string;
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
  },
  {
    name: "client.get",
    description: "Read a single client record, including creativePreference (AI_INHOUSE / AI_DESIGNER / MANUAL_ONLY), tier, status, and monthly budget. Use this before producing creative work for a client to route correctly.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "The Client entity id" }
      },
      required: ["clientId"]
    },
    requires: "client.read",
    handler: async (input, ctx) => {
      if (!ctx.can("client.read")) return { ok: false, error: "permission denied: client.read" };
      const c = await ctx.prisma.client.findFirst({
        where: { id: String(input.clientId), orgId: ctx.orgId },
        include: { _count: { select: { campaigns: true, briefs: true, leads: true, customers: true } } }
      });
      if (!c) return { ok: false, error: `client ${input.clientId} not found` };
      return {
        ok: true,
        output: {
          clientId: c.id,
          businessName: c.businessName,
          industry: c.industry,
          status: c.status,
          tier: c.tier,
          creativePreference: c.creativePreference,
          monthlyBudget: c.monthlyBudget,
          campaignCount: c._count.campaigns,
          briefCount: c._count.briefs,
          leadCount: c._count.leads,
          customerCount: c._count.customers
        }
      };
    }
  },
  {
    name: "client.update",
    description:
      "Propose a change to a client record. Critical fields (monthlyBudget, tier, status, creativePreference) are STAGED — they become an Approval record that an Adziga admin reviews in /app/admin/approvals. Minor fields (city, notes, contactPhone, etc.) apply immediately. The tool returns either { mode: 'applied', client } or { mode: 'pending', approval } — always tell the user which.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        patch: {
          type: "object",
          description: "Object of fields to update. Keys: monthlyBudget, tier, status, creativePreference, notes, contactPhone, contactEmail, contactName, industry, websiteUrl, city, country, businessModel.",
          properties: {
            businessName: { type: "string" },
            contactName: { type: "string" },
            contactEmail: { type: "string" },
            contactPhone: { type: "string" },
            industry: { type: "string" },
            websiteUrl: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
            businessModel: { type: "string" },
            monthlyBudget: { type: "number" },
            status: { type: "string", enum: ["ONBOARDING", "ACTIVE", "PAUSED", "CHURNED"] },
            tier: { type: "string", enum: ["FREE", "PRO", "ZIGA_PLUS"] },
            creativePreference: { type: "string", enum: ["AI_INHOUSE", "AI_DESIGNER", "MANUAL_ONLY"] },
            notes: { type: "string" }
          }
        },
        reason: { type: "string", description: "Short justification shown to the admin in the approval queue." }
      },
      required: ["clientId", "patch"]
    },
    requires: "client.update",
    handler: async (input, ctx) => {
      if (!ctx.can("client.update")) return { ok: false, error: "permission denied: client.update" };
      const { ClientService } = await import("@/server/services/client-service");
      const result = await ClientService.proposeUpdate(ctx.orgId, ctx.userId ?? ctx.agentId, String(input.clientId), input.patch as any, {
        requestedByKind: "agent",
        reason: input.reason ? String(input.reason) : undefined
      });
      return {
        ok: true,
        output: result,
        recordAction: {
          type: result.mode === "applied" ? "client.update" : "approval.request",
          summary:
            result.mode === "applied"
              ? `Updated client ${input.clientId}`
              : `Staged client update for admin approval`,
          payload: { clientId: input.clientId, mode: result.mode, severity: result.severity, approvalId: result.mode === "pending" ? result.approval.id : undefined }
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
  },
  {
    name: "creative.generateCopy",
    description:
      "Generate platform-aware ad copy (hook, headline, body, CTA) using Gemini. Returns multiple variants; pick one to persist via creative.create.",
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string", description: "What the copy should achieve and for whom" },
        platform: { type: "string", enum: ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "LINKEDIN", "YOUTUBE", "INSTAGRAM", "GENERIC"] },
        format: { type: "string", enum: ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"] },
        tone: { type: "string", enum: ["luxury", "playful", "trustworthy", "bold", "educational", "urgent"] },
        count: { type: "number", default: 3 },
        campaignId: { type: "string" },
        clientId: { type: "string" }
      },
      required: ["brief"]
    },
    requires: "creative.create",
    handler: async (input, ctx) => {
      if (!ctx.can("creative.create")) return { ok: false, error: "permission denied: creative.create" };
      const apiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
      const variants: Array<{ name: string; hook: string; headline: string; primaryCopy: string; cta: string }> = [];
      const sysPrompt = `You are a senior copywriter at Adziga. Match the requested tone, return ${input.count ?? 3} distinct variants. Each: name (≤60), hook (≤80), headline (≤60), primaryCopy (≤800), cta (≤24). Platform: ${input.platform}. Format: ${input.format}. Tone: ${input.tone ?? "luxury"}. Return JSON {variants: [...]}.`;
      if (apiKey) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 45_000);
          try {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: sysPrompt }] },
                  contents: [{ role: "user", parts: [{ text: `Brief: ${input.brief}` }] }],
                  generationConfig: { temperature: 0.8, maxOutputTokens: 4000, responseMimeType: "application/json" }
                }),
                signal: ctrl.signal
              }
            );
            if (r.ok) {
              const data = await r.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              const m = text.match(/\{[\s\S]*\}/);
              if (m) {
                const parsed = JSON.parse(m[0]);
                if (Array.isArray(parsed.variants)) variants.push(...parsed.variants);
              }
            }
          } finally {
            clearTimeout(t);
          }
        } catch (e) {
          // fall through to stub
        }
      }
      // Deterministic stub fallback so the agent always has copy to work with
      const wantCount = Number(input.count ?? 3);
      while (variants.length < wantCount) {
        const i = variants.length;
        variants.push({
          name: `${String(input.platform)} variant ${i + 1}`,
          hook: String(input.brief).slice(0, 80),
          headline: String(input.brief).slice(0, 60),
          primaryCopy: String(input.brief) + "\n\nEdit me — Gemini is offline so this is a stub.",
          cta: "Learn more"
        });
      }
      return {
        ok: true,
        output: { variants },
        recordAction: {
          type: "creative.generateCopy",
          summary: `Generated ${variants.length} copy variants`,
          payload: { count: variants.length, platform: input.platform, tone: input.tone }
        }
      };
    }
  },
  {
    name: "creative.generateImage",
    description:
      "Generate a visual creative (image) using Gemini image output. Saves the asset and creates a DRAFT Creative record. Returns the new creativeId.",
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string" },
        platform: { type: "string", enum: ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "GENERIC"] },
        style: { type: "string", enum: ["photoreal", "studio", "lifestyle", "ugc_phone_shot", "flat_lay", "infographic"] },
        aspectRatio: { type: "string", enum: ["1:1", "4:5", "9:16", "16:9"] },
        campaignId: { type: "string" },
        clientId: { type: "string" }
      },
      required: ["brief"]
    },
    requires: "creative.create",
    handler: async (input, ctx) => {
      if (!ctx.can("creative.create")) return { ok: false, error: "permission denied: creative.create" };
      const apiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
      const { randomUUID } = await import("node:crypto");
      const { saveAsset } = await import("@/lib/storage");
      const SIZE: Record<string, { w: number; h: number }> = {
        "1:1": { w: 1024, h: 1024 }, "4:5": { w: 1024, h: 1280 }, "9:16": { w: 1024, h: 1820 }, "16:9": { w: 1820, h: 1024 }
      };
      const aspectRatio = String(input.aspectRatio ?? "1:1");
      const size = SIZE[aspectRatio] ?? SIZE["1:1"]!;
      const w = size.w;
      const h = size.h;
      let buffer: Buffer | null = null;
      let model = "adziga-placeholder-v1";
      if (apiKey) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `${input.brief}. ${input.style ?? "studio"} style. No text overlays.` }] }],
                generationConfig: { temperature: 0.9, responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: input.aspectRatio ?? "1:1" } }
              })
            }
          );
          if (r.ok) {
            const data = await r.json();
            const inline = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
            if (inline?.data) {
              buffer = Buffer.from(inline.data, "base64");
              model = "gemini-2.0-flash-exp";
            }
          }
        } catch (e) { /* fall through */ }
      }
      if (!buffer) {
        const truncated = String(input.brief).slice(0, 80);
        const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f36d21"/><stop offset="100%" stop-color="#0a0a0a"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white" font-family="system-ui" font-size="${Math.max(28, w/18)}" font-weight="700">${truncated}</text></svg>`;
        buffer = Buffer.from(svg, "utf8");
      }
      const asset = await saveAsset({
        orgId: ctx.orgId,
        buffer,
        mimeType: model.startsWith("gemini") ? "image/png" : "image/svg+xml",
        originalName: `${randomUUID()}.${model.startsWith("gemini") ? "png" : "svg"}`,
        folder: "ai-generated"
      });
      const creative = await ctx.prisma.creative.create({
        data: {
          orgId: ctx.orgId,
          campaignId: input.campaignId ? String(input.campaignId) : null,
          name: String(input.brief).slice(0, 60),
          format: "IMAGE",
          platform: String(input.platform ?? "META"),
          primaryCopy: String(input.brief),
          mediaUrl: asset.url,
          thumbnailUrl: asset.url,
          source: "AI_GENERATED",
          creator: "AI (" + model + ")",
          status: "DRAFT"
        }
      });
      return {
        ok: true,
        output: { creativeId: creative.id, url: asset.url, model },
        recordAction: {
          type: "creative.generateImage",
          summary: `Generated image for "${creative.name}"`,
          payload: { creativeId: creative.id, model, url: asset.url }
        }
      };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Brief management tools (used by Content Agent to dispatch work to designers)
// ──────────────────────────────────────────────────────────────────────────

export const briefTools: ToolSpec[] = [
  {
    name: "brief.create",
    description:
      "Create a designer brief — a structured work item for a designer or freelancer to pick up. Returns the briefId so you can link creatives to it.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        brief: { type: "string", description: "What to produce. Markdown OK." },
        format: { type: "string", enum: ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC", "AUDIO"] },
        platform: { type: "string", enum: ["META", "GOOGLE", "WHATSAPP", "EMAIL", "INFLUENCER", "LINKEDIN", "INSTAGRAM", "YOUTUBE", "GENERIC"] },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
        dueDate: { type: "string", description: "ISO date string" },
        referenceUrls: { type: "array", items: { type: "string" } },
        copyDirection: { type: "string" },
        campaignId: { type: "string" },
        clientId: { type: "string" }
      },
      required: ["title", "brief", "format", "platform"]
    },
    requires: "briefs.write",
    handler: async (input, ctx) => {
      if (!ctx.can("briefs.write")) return { ok: false, error: "permission denied: briefs.write" };
      const brief = await ctx.prisma.brief.create({
        data: {
          orgId: ctx.orgId,
          clientId: input.clientId ? String(input.clientId) : null,
          campaignId: input.campaignId ? String(input.campaignId) : null,
          title: String(input.title),
          brief: String(input.brief),
          format: String(input.format),
          platform: String(input.platform),
          priority: String(input.priority ?? "NORMAL"),
          dueDate: input.dueDate ? new Date(String(input.dueDate)) : null,
          referenceUrls: Array.isArray(input.referenceUrls) ? input.referenceUrls.map(String) : [],
          copyDirection: input.copyDirection ? String(input.copyDirection) : null,
          createdById: ctx.invokedBy === "system" ? ctx.agentId : ctx.invokedBy,
          status: "OPEN"
        }
      });
      return {
        ok: true,
        output: { briefId: brief.id, title: brief.title, status: brief.status },
        recordAction: {
          type: "brief.create",
          summary: `Created designer brief "${brief.title}"`,
          payload: { briefId: brief.id, format: brief.format, platform: brief.platform }
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
  ...briefTools,
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
