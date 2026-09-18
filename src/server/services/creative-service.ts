// Adziga — Creative Service
// Centralized creative library management.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ConflictError } from "@/server/errors";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["PAUSED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: []
};

export const CreativeService = {
  async list(orgId: string) {
    return prisma.creative.findMany({
      where: { orgId },
      include: { campaign: { include: { client: true } } },
      orderBy: { createdAt: "desc" }
    });
  },

  async get(orgId: string, id: string) {
    const c = await prisma.creative.findFirst({
      where: { id, orgId },
      include: { campaign: { include: { client: true } } }
    });
    if (!c) throw new NotFoundError("Creative", id);
    return c;
  },

  async create(orgId: string, userId: string, input: {
    name: string;
    campaignId?: string;
    format: string;
    platform: string;
    hook?: string;
    headline?: string;
    primaryCopy?: string;
    cta?: string;
    creator?: string;
    audience?: string;
  }) {
    const c = await prisma.creative.create({
      data: {
        orgId,
        campaignId: input.campaignId,
        name: input.name,
        format: input.format,
        platform: input.platform,
        hook: input.hook ?? null,
        headline: input.headline ?? null,
        primaryCopy: input.primaryCopy ?? null,
        cta: input.cta ?? null,
        creator: input.creator ?? null,
        audience: input.audience ?? null,
        status: "DRAFT"
      }
    });
    await audit(orgId, userId, "creative.create", { entityType: "Creative", entityId: c.id });
    return c;
  },

  async update(orgId: string, userId: string, id: string, data: Record<string, any>) {
    const c = await prisma.creative.findFirst({ where: { id, orgId } });
    if (!c) throw new NotFoundError("Creative", id);
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await prisma.creative.update({ where: { id }, data: cleanData });
    await audit(orgId, userId, "creative.update", { entityType: "Creative", entityId: id, after: cleanData });
    return prisma.creative.findUnique({ where: { id } });
  },

  async transition(orgId: string, userId: string, id: string, to: string) {
    const c = await prisma.creative.findFirst({ where: { id, orgId } });
    if (!c) throw new NotFoundError("Creative", id);
    const valid = VALID_TRANSITIONS[c.status] ?? [];
    if (!valid.includes(to)) throw new ConflictError(`Cannot transition creative from ${c.status} to ${to}`);
    await prisma.creative.update({ where: { id }, data: { status: to } });
    await audit(orgId, userId, "creative.status_change", { entityType: "Creative", entityId: id, after: { status: to } });
    return prisma.creative.findUnique({ where: { id } });
  }
};