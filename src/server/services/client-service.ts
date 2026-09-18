// Adziga — Client Service
// All business logic for clients lives here. Pages and API routes call into this layer.
// Repository pattern: thin DB access is encapsulated in prisma queries; business rules live here.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/server/errors";

export const ClientService = {
  async list(orgId: string, opts?: { status?: string }) {
    return prisma.client.findMany({
      where: { orgId, ...(opts?.status ? { status: opts.status } : {}) },
      include: {
        campaigns: { select: { spent: true, leads: true, customers: true, revenue: true } },
        _count: { select: { campaigns: true, leads: true, customers: true, requests: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async get(orgId: string, id: string) {
    const c = await prisma.client.findFirst({
      where: { id, orgId },
      include: {
        campaigns: { orderBy: { createdAt: "desc" } },
        leads: { orderBy: { createdAt: "desc" }, take: 50 },
        customers: { orderBy: { acquiredAt: "desc" } },
        strategies: { orderBy: { version: "desc" } },
        events: { orderBy: { startAt: "desc" } },
        reports: { orderBy: { createdAt: "desc" } },
        requests: { orderBy: { createdAt: "desc" } },
        decisions: { orderBy: { createdAt: "desc" }, take: 10 },
        experiments: { orderBy: { createdAt: "desc" } },
        onboarding: true
      }
    });
    if (!c) throw new NotFoundError("Client", id);
    return c;
  },

  async create(orgId: string, userId: string, input: {
    businessName: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string | null;
    industry?: string | null;
    websiteUrl?: string | null;
    city?: string | null;
    country?: string | null;
    businessModel?: string | null;
    monthlyBudget?: number | null;
  }) {
    const c = await prisma.client.create({
      data: {
        orgId,
        businessName: input.businessName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        industry: input.industry ?? null,
        websiteUrl: input.websiteUrl ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        businessModel: input.businessModel ?? null,
        monthlyBudget: input.monthlyBudget ?? 0,
        tier: "PRO",
        status: "ACTIVE",
        contractStart: new Date()
      }
    });
    await audit(orgId, userId, "client.create", {
      entityType: "Client",
      entityId: c.id,
      after: { businessName: input.businessName }
    });
    return c;
  }
};