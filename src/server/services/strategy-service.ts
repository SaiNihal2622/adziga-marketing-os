// Adziga — Strategy Service
// Versioned strategies with approval gates.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ConflictError } from "@/server/errors";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["CLIENT_APPROVAL", "DRAFT"],
  CLIENT_APPROVAL: ["APPROVED", "INTERNAL_REVIEW"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: []
};

export const StrategyService = {
  async list(orgId: string) {
    return prisma.strategy.findMany({
      where: { orgId },
      include: { client: true, author: true, approver: true },
      orderBy: { updatedAt: "desc" }
    });
  },

  async get(orgId: string, id: string) {
    const s = await prisma.strategy.findFirst({
      where: { id, orgId },
      include: { client: true, author: true, approver: true }
    });
    if (!s) throw new NotFoundError("Strategy", id);
    return s;
  },

  async create(orgId: string, userId: string, input: { title: string; clientId?: string }) {
    const s = await prisma.strategy.create({
      data: {
        orgId,
        clientId: input.clientId,
        title: input.title,
        version: 1,
        status: "DRAFT",
        authorId: userId
      }
    });
    await audit(orgId, userId, "strategy.create", {
      entityType: "Strategy",
      entityId: s.id,
      after: { title: input.title, version: 1 }
    });
    return s;
  },

  async update(orgId: string, userId: string, id: string, data: Record<string, any>) {
    const s = await prisma.strategy.findFirst({ where: { id, orgId } });
    if (!s) throw new NotFoundError("Strategy", id);

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    await prisma.strategy.update({ where: { id }, data: cleanData });
    await audit(orgId, userId, "strategy.update", { entityType: "Strategy", entityId: id, after: cleanData });
    return prisma.strategy.findUnique({ where: { id } });
  },

  async createVersion(orgId: string, userId: string, parentId: string, changeReason: string) {
    const parent = await prisma.strategy.findFirst({ where: { id: parentId, orgId } });
    if (!parent) throw new NotFoundError("Strategy", parentId);

    // Snapshot all fields except id, version, status, changeReason, author, timestamps
    const snapshot = {
      businessObjective: parent.businessObjective,
      targetAudience: parent.targetAudience,
      market: parent.market,
      offer: parent.offer,
      positioning: parent.positioning,
      campaignObjective: parent.campaignObjective,
      channels: parent.channels,
      budget: parent.budget,
      timeline: parent.timeline,
      creativeStrategy: parent.creativeStrategy,
      leadStrategy: parent.leadStrategy,
      conversionStrategy: parent.conversionStrategy,
      kpis: parent.kpis,
      successCriteria: parent.successCriteria,
      risks: parent.risks,
      assumptions: parent.assumptions
    };

    const next = await prisma.strategy.create({
      data: {
        ...snapshot,
        orgId: parent.orgId,
        clientId: parent.clientId,
        title: parent.title,
        version: parent.version + 1,
        parentId: parent.id,
        status: "DRAFT",
        changeReason,
        authorId: userId
      }
    });
    await audit(orgId, userId, "strategy.new_version", {
      entityType: "Strategy",
      entityId: next.id,
      after: { fromVersion: parent.version, toVersion: next.version, changeReason }
    });
    return next;
  },

  async transition(orgId: string, userId: string, id: string, to: string) {
    const s = await prisma.strategy.findFirst({ where: { id, orgId } });
    if (!s) throw new NotFoundError("Strategy", id);

    const valid = VALID_TRANSITIONS[s.status] ?? [];
    if (!valid.includes(to)) {
      throw new ConflictError(`Cannot transition strategy from ${s.status} to ${to}`);
    }

    const data: any = { status: to };
    if (to === "APPROVED") {
      data.approverId = userId;
      data.approvedAt = new Date();
    }

    await prisma.strategy.update({ where: { id }, data });
    await audit(orgId, userId, "strategy.status_change", {
      entityType: "Strategy",
      entityId: id,
      after: { status: to }
    });
    return prisma.strategy.findUnique({ where: { id } });
  }
};