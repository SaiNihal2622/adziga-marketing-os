// Adziga — /api/intelligence/precedents
// Search the org's institutional memory for past decisions, experiments,
// approvals, lead outcomes, and campaign outcomes similar to the query.
// The Strategy Agent calls this before recommending an action.

import { z } from "zod";
import { authedRoute } from "@/server/api";
import { RetrievalService } from "@/server/services/retrieval-service";

const querySchema = z.object({
  q: z.string().min(2),
  clientId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  format: z.enum(["json", "prompt"]).optional()
});

export const GET = authedRoute<z.infer<typeof querySchema>>(
  null,
  async (ctx) => {
    const url = ctx.req.nextUrl;
    const q = url.searchParams.get("q") ?? "";
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const format = (url.searchParams.get("format") ?? "json") as "json" | "prompt";

    if (!q || q.length < 2) {
      return { precedents: [], promptContext: "" };
    }

    const input = { orgId: ctx.orgId, query: q, clientId, campaignId, limit };

    if (format === "prompt") {
      const promptContext = await RetrievalService.formatForPrompt(input);
      return { promptContext };
    }

    const precedents = await RetrievalService.search(input);
    return { precedents };
  }
);

export const POST = authedRoute<{ query: string; clientId?: string; campaignId?: string; limit?: number; format?: "json" | "prompt" }>(
  z.object({
    query: z.string().min(2),
    clientId: z.string().optional(),
    campaignId: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
    format: z.enum(["json", "prompt"]).optional()
  }),
  async (ctx, body) => {
    const input = {
      orgId: ctx.orgId,
      query: body.query,
      clientId: body.clientId,
      campaignId: body.campaignId,
      limit: body.limit
    };
    if (body.format === "prompt") {
      return { promptContext: await RetrievalService.formatForPrompt(input) };
    }
    return { precedents: await RetrievalService.search(input) };
  }
);
