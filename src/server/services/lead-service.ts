// Adziga — Lead Service
// Full lead lifecycle with attribution, scoring, auto-assignment.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { scoreLead } from "@/lib/intelligence/lead-router";
import { NotFoundError, ConflictError } from "@/server/errors";

export const LeadService = {
  async list(orgId: string, opts: {
    clientId?: string;
    status?: string;
    source?: string;
    q?: string;
    take?: number;
  }) {
    const where: any = { orgId };
    if (opts.clientId) where.clientId = opts.clientId;
    if (opts.status) where.status = opts.status;
    if (opts.source) where.source = opts.source;
    if (opts.q) {
      where.OR = [
        { name: { contains: opts.q } },
        { email: { contains: opts.q } },
        { phone: { contains: opts.q } },
        { city: { contains: opts.q } }
      ];
    }
    return prisma.lead.findMany({
      where,
      include: { client: true, campaign: true },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 200
    });
  },

  async get(orgId: string, id: string) {
    const l = await prisma.lead.findFirst({
      where: { id, orgId },
      include: { client: true, campaign: true, influencer: true, event: true, customer: true }
    });
    if (!l) throw new NotFoundError("Lead", id);
    return l;
  },

  async create(orgId: string, userId: string, input: {
    clientId: string;
    campaignId?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    source: string;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    clickId?: string | null;
    landingPage?: string | null;
    score?: number;
  }) {
    // Verify client belongs to org (tenant isolation enforced)
    const client = await prisma.client.findFirst({ where: { id: input.clientId, orgId } });
    if (!client) throw new NotFoundError("Client", input.clientId);

    const l = await prisma.lead.create({
      data: {
        orgId,
        clientId: input.clientId,
        campaignId: input.campaignId,
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        source: input.source,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        clickId: input.clickId ?? null,
        landingPage: input.landingPage ?? null,
        score: input.score ?? 0,
        status: "NEW"
      }
    });
    await audit(orgId, userId, "lead.create", { entityType: "Lead", entityId: l.id });

    // Sprint 6 — if any RUNNING experiment targets this lead's campaign,
    // deterministically bucket the lead into a variant. Best-effort.
    try {
      const { ExperimentService } = await import("@/server/services/experiment-service");
      await ExperimentService.assignLead(prisma, {
        id: l.id,
        orgId,
        clientId: l.clientId,
        campaignId: l.campaignId ?? null
      });
    } catch (e) {
      console.warn("experiment_assign_failed", String(e).slice(0, 200));
    }

    return l;
  },

  async updateStatus(orgId: string, userId: string, id: string, status: string, opts?: { score?: number; qualificationData?: string; revenue?: number }) {
    const l = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!l) throw new NotFoundError("Lead", id);

    const data: any = { status };
    if (opts?.score !== undefined) data.score = opts.score;
    if (opts?.qualificationData !== undefined) data.qualificationData = opts.qualificationData;
    if (["CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"].includes(status)) data.lastContactAt = new Date();
    if (status === "WON") {
      data.wonAt = new Date();
      if (opts?.revenue !== undefined) data.revenue = opts.revenue;

      // Convert to customer on WON (idempotent)
      const existing = await prisma.customer.findFirst({ where: { leadId: id } });
      if (!existing) {
        await prisma.customer.create({
          data: {
            orgId,
            clientId: l.clientId,
            leadId: l.id,
            name: l.name ?? "Customer",
            email: l.email,
            phone: l.phone,
            revenue: opts?.revenue ?? 0,
            acquiredAt: new Date()
          }
        });
      }
    }
    if (status === "LOST") data.lostAt = new Date();

    const updated = await prisma.lead.update({ where: { id }, data });
    await audit(orgId, userId, "lead.status_change", {
      entityType: "Lead",
      entityId: id,
      before: { status: l.status },
      after: { status }
    });

    // Sprint 6 — feed running A/B experiments. Best-effort; never throw.
    try {
      const { ExperimentService } = await import("@/server/services/experiment-service");
      if (status === "QUALIFIED" || status === "WON" || status === "LOST") {
        await ExperimentService.recordOutcome(prisma, id, status as any, opts?.revenue ?? 0);
      }
    } catch (e) {
      console.warn("experiment_outcome_record_failed", String(e).slice(0, 200));
    }

    return updated;
  },

  async scoreAndAssign(orgId: string, userId: string, leadId: string) {
    const l = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!l) throw new NotFoundError("Lead", leadId);

    const score = scoreLead({
      source: l.source,
      city: l.city,
      email: l.email,
      phone: l.phone,
      campaignId: l.campaignId
    });

    await prisma.$transaction([
      prisma.leadScore.upsert({
        where: { leadId: l.id },
        update: { score, factors: JSON.stringify({ source: l.source, city: l.city }), computedAt: new Date() },
        create: { orgId, leadId: l.id, score, factors: JSON.stringify({ source: l.source, city: l.city }) }
      }),
      prisma.lead.update({ where: { id: l.id }, data: { score } })
    ]);

    return { id: leadId, leadId, score };
  }
};