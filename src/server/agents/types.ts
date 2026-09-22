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
    description:
      "Compute a recommended budget allocation across channels using the value-based allocator. Each channel is weighted by its value-per-rupee (revenue or predicted value from qualified × customer rate × avg deal size) rather than raw CPL. Returns per-platform allocation, rupee amounts, and per-channel reasoning. Does NOT create campaigns — call campaign.create to materialize.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        totalBudget: { type: "number" },
        days: { type: "number", default: 60 }
      },
      required: ["totalBudget"]
    },
    requires: "budget.read",
    handler: async (input, ctx) => {
      const { AttributionService } = await import("@/server/services/attribution-service");
      const totalBudget = Number(input.totalBudget);
      const days = Number(input.days ?? 60);
      const result = await AttributionService.valueBasedAllocate(ctx.orgId, {
        totalBudget,
        clientId: input.clientId ? String(input.clientId) : undefined,
        since: new Date(Date.now() - days * 86_400_000)
      });
      return {
        ok: true,
        output: result,
        recordAction: {
          type: "budget.allocate",
          summary: `Allocated ₹${totalBudget.toLocaleString("en-IN")} across ${result.allocations.length} channels (value-based)`,
          payload: {
            totalBudget,
            topChannel: result.allocations[0]?.platform ?? null,
            reasoning: result.reasoning
          }
        }
      };
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
      const brief = String(input.brief);
      const style = String(input.style ?? "studio");

      let buffer: Buffer | null = null;
      let model = "adziga-placeholder-v1";
      let mimeType: "image/png" | "image/jpeg" | "image/svg+xml" = "image/svg+xml";

      // ── Strategy: try real image models in order, fall through to placeholder.
      // 1. Gemini image-capable models (in case 2.0-flash-exp / imagen-3 / 2.5-flash-image are enabled)
      // 2. Pollinations.ai — free, no key, public Flux endpoint
      // 3. Branded SVG placeholder

      const geminiImageModels = ["imagen-3.0-generate-002", "gemini-2.0-flash-exp", "gemini-2.5-flash-image-preview"];
      const promptText = `${brief}. ${style} style, no text overlays, no watermarks, advertising creative, professional composition.`;

      if (apiKey) {
        for (const m of geminiImageModels) {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 25_000);
            try {
              // Imagen endpoint (predict) vs Gemini multimodal endpoint have different shapes.
              const isImagen = m.startsWith("imagen");
              const url = isImagen
                ? `https://generativelanguage.googleapis.com/v1beta/models/${m}:predict?key=${apiKey}`
                : `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
              const body = isImagen
                ? { instances: [{ prompt: promptText }], parameters: { sampleCount: 1, aspectRatio } }
                : {
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    generationConfig: {
                      temperature: 0.9,
                      responseModalities: ["TEXT", "IMAGE"],
                      imageConfig: { aspectRatio }
                    }
                  };
              const r = await fetch(url, {
                method: "POST",
                headers: isImagen ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify(body),
                signal: ctrl.signal
              });
              if (r.ok) {
                const data = await r.json();
                let inlineB64: string | null = null;
                if (isImagen) {
                  inlineB64 = data?.predictions?.[0]?.bytesBase64Encoded ?? null;
                } else {
                  const inline = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
                  inlineB64 = inline?.data ?? null;
                }
                if (inlineB64) {
                  buffer = Buffer.from(inlineB64, "base64");
                  model = m;
                  mimeType = "image/png";
                  break;
                }
              }
            } finally {
              clearTimeout(t);
            }
          } catch (e) {
            // try next model
          }
        }
      }

      // Pollinations fallback — free, no key. Uses the public Flux endpoint.
      if (!buffer) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 30_000);
          try {
            const polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=${w}&height=${h}&nologo=true&model=flux&enhance=true`;
            const r = await fetch(polUrl, { signal: ctrl.signal });
            if (r.ok) {
              const ct = r.headers.get("content-type") ?? "";
              if (ct.startsWith("image/")) {
                const arr = await r.arrayBuffer();
                if (arr.byteLength > 1024) {
                  buffer = Buffer.from(arr);
                  model = "pollinations-flux";
                  mimeType = ct.includes("jpeg") || ct.includes("jpg") ? "image/jpeg" : "image/png";
                }
              }
            }
          } finally {
            clearTimeout(t);
          }
        } catch (e) {
          // fall through
        }
      }

      // Final fallback: branded SVG placeholder
      if (!buffer) {
        const truncated = brief.slice(0, 80);
        const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f36d21"/><stop offset="100%" stop-color="#0a0a0a"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white" font-family="system-ui" font-size="${Math.max(28, w/18)}" font-weight="700">${truncated}</text></svg>`;
        buffer = Buffer.from(svg, "utf8");
        model = "adziga-placeholder-v1";
        mimeType = "image/svg+xml";
      }

      const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "svg";
      const asset = await saveAsset({
        orgId: ctx.orgId,
        buffer,
        mimeType,
        originalName: `${randomUUID()}.${ext}`,
        folder: "ai-generated"
      });
      const creative = await ctx.prisma.creative.create({
        data: {
          orgId: ctx.orgId,
          campaignId: input.campaignId ? String(input.campaignId) : null,
          name: brief.slice(0, 60),
          format: "IMAGE",
          platform: String(input.platform ?? "META"),
          primaryCopy: brief,
          mediaUrl: asset.url,
          thumbnailUrl: asset.url,
          source: "AI_GENERATED",
          creator: "AI (" + model + ")",
          status: "DRAFT"
        }
      });
      return {
        ok: true,
        output: { creativeId: creative.id, url: asset.url, model, mimeType },
        recordAction: {
          type: "creative.generateImage",
          summary: `Generated image for "${creative.name}" (${model})`,
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
// ROI + Predictive tools (Sprint 7a / 7b)
// ──────────────────────────────────────────────────────────────────────────

export const analyticsReadTools: ToolSpec[] = [
  {
    name: "analytics.roi",
    description:
      "Compute a per-client ROI report. Includes revenue, spend, net ROI, ROAS, CAC, average deal size, total leads/qualified/customers, channel breakdown, funnel waterfall, daily revenue vs spend time series, and per-experiment impact estimates. Use this when the user asks 'what's our ROI for client X' or wants to compare clients.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        days: { type: "number", default: 60 }
      },
      required: ["clientId"]
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      if (!ctx.can("analytics.read")) return { ok: false, error: "permission denied: analytics.read" };
      const { ROIService } = await import("@/server/services/roi-service");
      const report = await ROIService.clientRoiReport(ctx.orgId, String(input.clientId), Number(input.days ?? 60));
      // Don't dump the full time series — just KPI + top 5 channel rows + top 3 experiments.
      return {
        ok: true,
        output: {
          client: report.client.businessName,
          windowDays: report.window.days,
          kpis: report.kpis,
          topChannels: report.byChannel.slice(0, 5),
          topExperiments: report.experiments.slice(0, 3),
          alerts: report.alerts,
          waterfall: report.waterfall
        }
      };
    }
  },
  {
    name: "analytics.roi.org",
    description:
      "Compute the org-wide ROI dashboard across all clients. Top-line numbers, top 10 clients by revenue, channel breakdown, top experiments.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", default: 60 } }
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      if (!ctx.can("analytics.read")) return { ok: false, error: "permission denied: analytics.read" };
      const { ROIService } = await import("@/server/services/roi-service");
      const d = await ROIService.orgWideDashboard(ctx.orgId, Number(input.days ?? 60));
      return {
        ok: true,
        output: {
          windowDays: d.window.days,
          kpis: d.kpis,
          topClients: d.topClients,
          topPlatforms: d.byPlatform.slice(0, 8),
          topExperiments: d.byExperiment.slice(0, 5),
          alerts: d.alerts
        }
      };
    }
  },
  {
    name: "analytics.predict",
    description:
      "Predict outcomes (expected leads, customers, revenue, ROAS, CAC) for a proposed marketing plan BEFORE running it. Uses Bayesian shrinkage of per-channel historical conversion with industry benchmarks. Returns expected + a confidence band. Use this when the user asks 'if we spend X on Y platform, what can we expect?'",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        industry: { type: "string" },
        plan: {
          type: "object",
          properties: {
            totalBudget: { type: "number" },
            channels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string" },
                  totalBudget: { type: "number" },
                  days: { type: "number" }
                },
                required: ["platform", "totalBudget"]
              }
            }
          },
          required: ["channels"]
        }
      },
      required: ["plan"]
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      if (!ctx.can("analytics.read")) return { ok: false, error: "permission denied: analytics.read" };
      const { PredictiveOutcomeModel } = await import("@/server/services/predictive-service");
      const plan = (input.plan ?? {}) as any;
      const prediction = await PredictiveOutcomeModel.predict({
        orgId: ctx.orgId,
        clientId: input.clientId ? String(input.clientId) : undefined,
        industry: input.industry ? String(input.industry) : undefined,
        plan: {
          totalBudget: plan.totalBudget ? Number(plan.totalBudget) : undefined,
          channels: (plan.channels ?? []).map((c: any) => ({
            platform: String(c.platform),
            totalBudget: Number(c.totalBudget),
            days: c.days ? Number(c.days) : undefined
          }))
        }
      });
      return {
        ok: true,
        output: {
          expectedCpl: prediction.expectedCpl,
          expectedCac: prediction.expectedCac,
          expectedConversionRate: prediction.expectedConversionRate,
          expectedCustomers: prediction.expectedCustomers,
          expectedRevenue: prediction.expectedRevenue,
          expectedRoas: prediction.expectedRoas,
          totalBudget: prediction.totalBudget,
          confidence: prediction.confidence,
          sampleSize: prediction.sampleSize,
          band: prediction.band,
          perChannel: prediction.perChannel,
          caveat: prediction.caveat
        }
      };
    }
  }
];

// ──────────────────────────────────────────────────────────────────────────
// Experiment tools (A/B testing — Sprint 6)
// ──────────────────────────────────────────────────────────────────────────

export const experimentTools: ToolSpec[] = [
  {
    name: "experiment.list",
    description: "List experiments for the org with status, variant count, and assignments.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PLANNED", "RUNNING", "COMPLETED", "CANCELLED"] }
      }
    },
    requires: "experiment.read",
    handler: async (input, ctx) => {
      if (!ctx.can("experiment.read")) return { ok: false, error: "permission denied: experiment.read" };
      const where: any = { orgId: ctx.orgId };
      if (input.status) where.status = String(input.status);
      const experiments = await ctx.prisma.experiment.findMany({
        where,
        include: {
          client: true,
          campaign: true,
          variants: true,
          _count: { select: { assignments: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      return {
        ok: true,
        output: experiments.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          kpi: e.kpi,
          metric: e.metric,
          winnerVariantId: e.winnerVariantId,
          variantCount: e.variants.length,
          assignments: e._count.assignments
        }))
      };
    }
  },
  {
    name: "experiment.analyze",
    description:
      "Run a Bayesian beta-binomial analysis on a running or completed experiment. Returns per-variant posterior mean, 95% credible interval, P(best), and a recommended winner if one exists (P≥0.95 AND sample size met).",
    inputSchema: {
      type: "object",
      properties: { experimentId: { type: "string" } },
      required: ["experimentId"]
    },
    requires: "experiment.read",
    handler: async (input, ctx) => {
      if (!ctx.can("experiment.read")) return { ok: false, error: "permission denied: experiment.read" };
      const { ExperimentService } = await import("@/server/services/experiment-service");
      const e = await ctx.prisma.experiment.findFirst({
        where: { id: String(input.experimentId), orgId: ctx.orgId },
        select: { id: true }
      });
      if (!e) return { ok: false, error: "experiment not found" };
      const analysis = await ExperimentService.analyze(ctx.prisma, e.id);
      return {
        ok: true,
        output: {
          experimentId: analysis.experimentId,
          status: analysis.status,
          canDeclareWinner: analysis.canDeclareWinner,
          reason: analysis.reason,
          winnerVariantId: analysis.winner?.variantId ?? null,
          variants: analysis.variants.map((v) => ({
            label: v.label,
            kind: v.kind,
            assigned: v.assignedCount,
            converted: v.convertedCount,
            rate: v.posteriorMean,
            ci95: v.credibleInterval,
            pBest: v.probOfBeingBest,
            liftVsControl: v.liftVsControl
          }))
        }
      };
    }
  },
  {
    name: "experiment.start",
    description: "Transition a PLANNED experiment to RUNNING. Requires ≥ 2 variants.",
    inputSchema: {
      type: "object",
      properties: { experimentId: { type: "string" } },
      required: ["experimentId"]
    },
    requires: "experiment.update",
    handler: async (input, ctx) => {
      if (!ctx.can("experiment.update")) return { ok: false, error: "permission denied: experiment.update" };
      const e = await ctx.prisma.experiment.findFirst({
        where: { id: String(input.experimentId), orgId: ctx.orgId }
      });
      if (!e) return { ok: false, error: "experiment not found" };
      if (e.status !== "PLANNED") return { ok: false, error: `cannot start: experiment is ${e.status}` };
      const v = await ctx.prisma.experimentVariant.count({ where: { experimentId: e.id } });
      if (v < 2) return { ok: false, error: "need at least 2 variants before starting" };
      const updated = await ctx.prisma.experiment.update({
        where: { id: e.id },
        data: { status: "RUNNING", startedAt: new Date() }
      });
      return {
        ok: true,
        output: { experimentId: updated.id, status: updated.status },
        recordAction: {
          type: "experiment.start",
          summary: `Started experiment "${updated.title}"`,
          payload: { experimentId: updated.id }
        }
      };
    }
  },
  {
    name: "experiment.complete",
    description:
      "Mark a RUNNING experiment COMPLETED. Runs the Bayesian analysis; if a winner exists, freezes it. Optional human-readable conclusion.",
    inputSchema: {
      type: "object",
      properties: {
        experimentId: { type: "string" },
        conclusion: { type: "string" }
      },
      required: ["experimentId"]
    },
    requires: "experiment.update",
    handler: async (input, ctx) => {
      if (!ctx.can("experiment.update")) return { ok: false, error: "permission denied: experiment.update" };
      const e = await ctx.prisma.experiment.findFirst({
        where: { id: String(input.experimentId), orgId: ctx.orgId }
      });
      if (!e) return { ok: false, error: "experiment not found" };
      if (e.status !== "RUNNING") return { ok: false, error: `cannot complete: experiment is ${e.status}` };
      const { ExperimentService } = await import("@/server/services/experiment-service");
      const r = await ExperimentService.completeExperiment(
        ctx.prisma,
        e.id,
        input.conclusion ? String(input.conclusion) : ""
      );
      return {
        ok: true,
        output: { experimentId: e.id, winnerVariantId: r.winnerVariantId, conclusion: r.conclusion },
        recordAction: {
          type: "experiment.complete",
          summary: `Completed experiment "${e.title}" — ${r.winnerVariantId ? `winner frozen (variant ${r.winnerVariantId})` : "no winner"}`,
          payload: { experimentId: e.id, winnerVariantId: r.winnerVariantId }
        }
      };
    }
  }
];

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
  },
  {
    name: "analytics.campaignAnomalies",
    description:
      "Sprint 9b — per-campaign anomaly detection with auto-pause recommendation. Returns each active campaign's CPL/spend/leads anomalies plus an overall recommendAction (pause / watch / scale / none) and a short reason. Use this when the user asks which campaigns to pause, which are running efficiently, or what's drifting off-baseline.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", default: 30 },
        recommendation: { type: "string", enum: ["pause", "watch", "scale"] }
      }
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      const { CampaignAnomalyService } = await import("@/server/services/campaign-anomaly-service");
      let result = await CampaignAnomalyService.detectForOrg(ctx.orgId, Number(input.days ?? 30));
      if (input.recommendation) {
        result = result.filter((a) => a.recommendAction === input.recommendation);
      }
      // Trim noisy detail — top 3 metrics per campaign.
      return {
        ok: true,
        output: {
          count: result.length,
          pauseCandidates: result.filter((a) => a.recommendAction === "pause").map((a) => ({ campaignId: a.campaignId, campaignName: a.campaignName, platform: a.platform, reason: a.reason })),
          scaleCandidates: result.filter((a) => a.recommendAction === "scale").map((a) => ({ campaignId: a.campaignId, campaignName: a.campaignName, platform: a.platform, reason: a.reason })),
          full: result.slice(0, 20).map((a) => ({
            campaignId: a.campaignId,
            campaignName: a.campaignName,
            platform: a.platform,
            status: a.status,
            recommendAction: a.recommendAction,
            reason: a.reason,
            topMetrics: a.metrics.slice(0, 3)
          }))
        }
      };
    }
  },
  {
    name: "experiment.promote",
    description:
      "Sprint 9c — when an experiment declares a winner, this tool promotes the winning variant's config into a StrategyRecommendation that the team reviews. Returns the promotion id and the winner's config + recommended channels. Use after experiment.complete.",
    inputSchema: {
      type: "object",
      properties: {
        experimentId: { type: "string" },
        channels: { type: "array", items: { type: "string" } }
      },
      required: ["experimentId"]
    },
    requires: "experiment.update",
    handler: async (input, ctx) => {
      const { ExperimentService } = await import("@/server/services/experiment-service");
      const promo = await ExperimentService.promoteWinner(ctx.prisma, String(input.experimentId), {
        createdById: ctx.userId ?? ctx.agentId,
        channels: Array.isArray(input.channels) ? input.channels.map(String) : undefined
      });
      if (!promo) {
        return { ok: false, error: "experiment has no winner yet — complete it first" };
      }
      return {
        ok: true,
        output: promo,
        recordAction: {
          type: "experiment.promote",
          summary: `Promoted winner "${promo.winnerLabel}" (config: ${JSON.stringify(promo.winnerConfig)}) for ${promo.recommendedChannels.join(", ") || "default channels"}`,
          payload: { promotionId: promo.promotionId, experimentId: input.experimentId }
        }
      };
    }
  },
  {
    name: "analytics.ingestSpend",
    description:
      "Sprint 10a — bulk-ingest daily ad-spend rows into Adziga. Use this when the team (or a cron) needs to push Meta/Google/manual spend data. Each row has {campaignId or campaignExternalId, date (YYYY-MM-DD), amount, platform}. Idempotent — re-ingesting the same data is safe.",
    inputSchema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              campaignId: { type: "string" },
              campaignExternalId: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              amount: { type: "number" },
              platform: { type: "string" },
              currency: { type: "string" },
              source: { type: "string" }
            },
            required: ["date", "amount", "platform"]
          }
        }
      },
      required: ["rows"]
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      if (!ctx.can("analytics.read")) return { ok: false, error: "permission denied" };
      const { AdSpendIngestionService } = await import("@/server/services/ad-spend-ingestion");
      const rows = (input.rows ?? []) as any[];
      const result = await AdSpendIngestionService.upsertDailySpend(ctx.orgId, rows, {
        userId: ctx.userId
      });
      return {
        ok: true,
        output: result,
        recordAction: {
          type: "analytics.ingestSpend",
          summary: `Ingested ${result.accepted} ad-spend rows (${result.rejected} rejected) for ${result.campaignsTouched.length} campaigns`,
          payload: { accepted: result.accepted, rejected: result.rejected, campaignsTouched: result.campaignsTouched.length }
        }
      };
    }
  },
  {
    name: "analytics.pullMetaInsights",
    description:
      "Sprint 10a — pull last N days of Meta Marketing Insights for a single campaign and ingest them into AdSpend. Requires META_ACCESS_TOKEN env var and the campaign's externalId to be set to the Meta campaign id.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        days: { type: "number", default: 7 }
      },
      required: ["campaignId"]
    },
    requires: "analytics.read",
    handler: async (input, ctx) => {
      const { AdSpendIngestionService } = await import("@/server/services/ad-spend-ingestion");
      try {
        const result = await AdSpendIngestionService.pullMetaCampaignInsights(
          ctx.orgId,
          String(input.campaignId),
          Number(input.days ?? 7)
        );
        return { ok: true, output: result };
      } catch (e) {
        return { ok: false, error: String((e as Error).message ?? e) };
      }
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
  ...competitorTools,
  ...experimentTools,
  ...analyticsReadTools
];

export const TOOL_BY_NAME: Record<string, ToolSpec> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t])
);

export function toolsForAgent(allowlist: string): ToolSpec[] {
  if (!allowlist || !allowlist.trim()) return [];
  const allowed = new Set(allowlist.split(",").map((s) => s.trim()).filter(Boolean));
  return ALL_TOOLS.filter((t) => allowed.has(t.requires));
}
