// Adziga — Campaign Service
// Workflow state transitions + aggregations.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ConflictError, ValidationError } from "@/server/errors";

// Valid state transitions per spec §17
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["CLIENT_APPROVAL", "DRAFT"],
  CLIENT_APPROVAL: ["READY", "INTERNAL_REVIEW"],
  READY: ["ACTIVE"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: []
};

export const CampaignService = {
  async list(orgId: string, opts?: { clientId?: string; status?: string; platform?: string }) {
    const where: any = { orgId };
    if (opts?.clientId) where.clientId = opts.clientId;
    if (opts?.status) where.status = opts.status;
    if (opts?.platform) where.platform = opts.platform;

    return prisma.campaign.findMany({
      where,
      include: {
        client: true,
        adSets: { include: { ads: true } },
        ads: true,
        creatives: true,
        _count: { select: { adSets: true, ads: true, creatives: true, leadEntries: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async get(orgId: string, id: string) {
    const c = await prisma.campaign.findFirst({
      where: { id, orgId },
      include: {
        client: true,
        adSets: { include: { ads: true } },
        ads: true,
        creatives: true,
        leadEntries: { orderBy: { createdAt: "desc" }, take: 20 },
        decisions: { orderBy: { createdAt: "desc" }, take: 10 },
        experiments: true,
        reports: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!c) throw new NotFoundError("Campaign", id);
    return c;
  },

  async create(orgId: string, userId: string, input: {
    name: string;
    clientId: string;
    platform: string;
    objective: string;
    budget?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
  }) {
    // Tenant isolation: verify client
    const client = await prisma.client.findFirst({ where: { id: input.clientId, orgId } });
    if (!client) throw new NotFoundError("Client", input.clientId);

    const c = await prisma.campaign.create({
      data: {
        orgId,
        clientId: input.clientId,
        name: input.name,
        platform: input.platform,
        objective: input.objective,
        budget: input.budget ?? null,
        startDate: input.startDate ?? new Date(),
        endDate: input.endDate ?? null,
        status: "DRAFT",
        health: "Healthy",
        utmSource: input.platform === "META" ? "meta" : input.platform === "GOOGLE" ? "google" : input.platform.toLowerCase(),
        utmMedium: "paid",
        utmCampaign: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      }
    });
    await audit(orgId, userId, "campaign.create", {
      entityType: "Campaign",
      entityId: c.id,
      after: { name: input.name, platform: input.platform }
    });
    return c;
  },

  async transition(orgId: string, userId: string, id: string, to: string) {
    const c = await prisma.campaign.findFirst({ where: { id, orgId } });
    if (!c) throw new NotFoundError("Campaign", id);

    const valid = VALID_TRANSITIONS[c.status] ?? [];
    if (!valid.includes(to)) {
      throw new ConflictError(`Cannot transition from ${c.status} to ${to}. Valid: ${valid.join(", ") || "(none)"}`);
    }

    const before = { status: c.status };
    await prisma.campaign.update({ where: { id }, data: { status: to } });
    await audit(orgId, userId, "campaign.status_change", {
      entityType: "Campaign",
      entityId: id,
      before,
      after: { status: to }
    });
    return { id, status: to };
  }
};