// Adziga — Campaign Service
// Lists / gets campaigns with BigInt-safe serialization.
// Proposes updates through the approval workflow — budgets and status
// changes always require admin sign-off, names / notes / utm_* apply immediately.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ValidationError } from "@/server/errors";
import { ApprovalService } from "./approval-service";

export const CampaignService = {
  async list(orgId: string, opts?: { clientId?: string; status?: string }) {
    const items = await prisma.campaign.findMany({
      where: {
        orgId,
        ...(opts?.clientId ? { clientId: opts.clientId } : {}),
        ...(opts?.status ? { status: opts.status } : {})
      },
      include: {
        client: { select: { id: true, businessName: true } },
        _count: { select: { ads: true, adSets: true, creatives: true, briefs: true, leadEntries: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return items.map(serializeCampaign);
  },

  async get(orgId: string, id: string) {
    const c = await prisma.campaign.findFirst({
      where: { id, orgId },
      include: {
        client: { select: { id: true, businessName: true } },
        adSets: { orderBy: { createdAt: "desc" } },
        ads: { orderBy: { createdAt: "desc" }, take: 50 },
        creatives: { orderBy: { createdAt: "desc" }, take: 50 },
        briefs: { orderBy: { createdAt: "desc" }, take: 20 },
        leadEntries: { orderBy: { createdAt: "desc" }, take: 50 },
        decisions: { orderBy: { createdAt: "desc" }, take: 10 },
        experiments: true
      }
    });
    if (!c) throw new NotFoundError("Campaign", id);
    return serializeCampaign(c);
  },

  async proposeUpdate(orgId: string, userId: string, campaignId: string, patch: Record<string, unknown>) {
    const existing = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
    if (!existing) throw new NotFoundError("Campaign", campaignId);

    const severity = ApprovalService.classify("Campaign", patch);
    const title = buildCampaignTitle(existing.name, patch);

    const result = await ApprovalService.request({
      orgId,
      entityType: "Campaign",
      entityId: campaignId,
      action: "update",
      title,
      payload: patch,
      requestedById: userId,
      requestedByKind: "user",
      severity,
      reason: null
    });

    if (result.autoApplied) {
      const refreshed = await prisma.campaign.findUnique({ where: { id: campaignId } });
      return { mode: "applied" as const, campaign: refreshed && serializeCampaign(refreshed), severity };
    }
    return { mode: "pending" as const, approval: result.approval, severity };
  }
};

function buildCampaignTitle(name: string, patch: Record<string, unknown>): string {
  const keys = Object.keys(patch);
  if (keys.length === 1) {
    const k = keys[0];
    const v = patch[k];
    const humanField = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    return `Campaign ${name} — ${humanField} → ${formatValue(v)}`;
  }
  return `Campaign ${name} — ${keys.length} fields updated`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(cleared)";
  if (typeof v === "number") {
    if (v >= 100000) return v.toLocaleString("en-IN");
    return String(v);
  }
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  return JSON.stringify(v);
}

function serializeCampaign<T extends { impressions?: bigint | number; reach?: bigint | number; clicks?: bigint | number; leads?: bigint | number; qualifiedLeads?: bigint | number; customers?: bigint | number }>(c: T): Omit<T, "impressions" | "reach" | "clicks" | "leads" | "qualifiedLeads" | "customers"> & {
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  customers: number;
} {
  return {
    ...c,
    impressions: Number(c.impressions ?? 0),
    reach: Number(c.reach ?? 0),
    clicks: Number(c.clicks ?? 0),
    leads: Number(c.leads ?? 0),
    qualifiedLeads: Number(c.qualifiedLeads ?? 0),
    customers: Number(c.customers ?? 0)
  };
}
