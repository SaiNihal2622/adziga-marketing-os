// Adziga — Client Service
// All business logic for clients lives here. Pages and API routes call into this layer.
// Repository pattern: thin DB access is encapsulated in prisma queries; business rules live here.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/server/errors";
import { ApprovalService } from "./approval-service";

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
  },

  /**
   * Propose an update to a client. Critical fields (monthlyBudget, tier,
   * creativePreference, status→CHURNED) are staged as Approval records and
   * must be applied by an Adziga admin before they take effect. Other fields
   * are applied immediately and audit-logged.
   *
   * Returns the in-flight approval (if gated) or the updated client (if applied).
   */
  async proposeUpdate(orgId: string, userId: string, clientId: string, patch: Record<string, unknown>, opts?: { requestedByKind?: "user" | "agent" | "client_user"; reason?: string }) {
    const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!existing) throw new NotFoundError("Client", clientId);

    const severity = ApprovalService.classify("Client", patch);
    const title = buildTitle("Client", existing.businessName, patch);

    const result = await ApprovalService.request({
      orgId,
      entityType: "Client",
      entityId: clientId,
      action: "update",
      title,
      payload: patch,
      requestedById: userId,
      requestedByKind: opts?.requestedByKind ?? "user",
      severity,
      reason: opts?.reason ?? null
    });

    if (result.autoApplied) {
      const refreshed = await prisma.client.findUnique({ where: { id: clientId } });
      return { mode: "applied" as const, client: refreshed, severity };
    }
    return { mode: "pending" as const, approval: result.approval, severity };
  },

  /**
   * Convenience for adziga admins / agents — apply directly without going
   * through approval (still audited).
   */
  async applyUpdate(orgId: string, userId: string, clientId: string, patch: Record<string, unknown>) {
    const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!existing) throw new NotFoundError("Client", clientId);
    const c = await prisma.client.update({ where: { id: clientId }, data: patch as any });
    await audit(orgId, userId, "client.update", {
      entityType: "Client",
      entityId: clientId,
      before: existing,
      after: patch
    });
    return c;
  }
};

function buildTitle(entityType: string, name: string, patch: Record<string, unknown>): string {
  const fields = Object.keys(patch);
  if (fields.length === 1) {
    const f = fields[0];
    const v = patch[f];
    const humanField = f
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
    return `${entityType} ${name} — ${humanField} → ${formatValue(v)}`;
  }
  return `${entityType} ${name} — ${fields.length} fields updated`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(cleared)";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  return JSON.stringify(v);
}