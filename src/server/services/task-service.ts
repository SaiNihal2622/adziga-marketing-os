// Adziga — Task, Request, Event, Influencer, Experiment, Report, Decision services
// All tenant-isolated, audit-logged, validated.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ConflictError } from "@/server/errors";

const TASK_TRANSITIONS: Record<string, string[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS", "DONE"],
  DONE: []
};

const REQUEST_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_CLIENT", "RESOLVED"],
  WAITING_CLIENT: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: []
};

const EVENT_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED"],
  REGISTRATION_CLOSED: ["LIVE", "CANCELLED"],
  LIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

const EXPERIMENT_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

const REPORT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: []
};

// ──────────────────────────────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────────────────────────────

export const TaskService = {
  async list(orgId: string) {
    return prisma.task.findMany({
      where: { orgId },
      include: { assignee: true, creator: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }]
    });
  },
  async create(orgId: string, userId: string, input: {
    title: string; description?: string; priority: string; dueDate?: Date | null; assigneeId?: string; clientId?: string;
  }) {
    const t = await prisma.task.create({
      data: {
        orgId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        status: "TODO",
        dueDate: input.dueDate ?? null,
        creatorId: userId,
        assigneeId: input.assigneeId,
        clientId: input.clientId
      }
    });
    await audit(orgId, userId, "task.create", { entityType: "Task", entityId: t.id });
    return t;
  },
  async transition(orgId: string, userId: string, id: string, to: string) {
    const t = await prisma.task.findFirst({ where: { id, orgId } });
    if (!t) throw new NotFoundError("Task", id);
    const valid = TASK_TRANSITIONS[t.status] ?? [];
    if (!valid.includes(to)) throw new ConflictError(`Cannot transition task from ${t.status} to ${to}`);
    await prisma.task.update({ where: { id }, data: { status: to } });
    await audit(orgId, userId, "task.status_change", { entityType: "Task", entityId: id, after: { status: to } });
    return prisma.task.findUnique({ where: { id } });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Client Requests
// ──────────────────────────────────────────────────────────────────────

export const ClientRequestService = {
  async list(orgId: string) {
    return prisma.clientRequest.findMany({
      where: { orgId },
      include: { client: true, submitter: true },
      orderBy: { createdAt: "desc" }
    });
  },
  async get(orgId: string, id: string) {
    const r = await prisma.clientRequest.findFirst({
      where: { id, orgId },
      include: { client: true, submitter: true }
    });
    if (!r) throw new NotFoundError("Request", id);
    return r;
  },
  async create(orgId: string, userId: string, input: {
    clientId: string; title: string; description: string; category: string; priority: string;
  }) {
    const r = await prisma.clientRequest.create({
      data: {
        orgId,
        clientId: input.clientId,
        submitterId: userId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: "SUBMITTED"
      }
    });
    await audit(orgId, userId, "request.create", { entityType: "ClientRequest", entityId: r.id });
    return r;
  },
  async transition(orgId: string, userId: string, id: string, to: string, resolution?: string) {
    const r = await prisma.clientRequest.findFirst({ where: { id, orgId } });
    if (!r) throw new NotFoundError("Request", id);
    const valid = REQUEST_TRANSITIONS[r.status] ?? [];
    if (!valid.includes(to)) throw new ConflictError(`Cannot transition request from ${r.status} to ${to}`);
    const data: any = { status: to };
    if (to === "RESOLVED") {
      data.resolvedAt = new Date();
      if (resolution) data.resolution = resolution;
    }
    await prisma.clientRequest.update({ where: { id }, data });
    await audit(orgId, userId, "request.status_change", { entityType: "ClientRequest", entityId: id, after: { status: to } });
    return prisma.clientRequest.findUnique({ where: { id } });
  },
  async addComment(orgId: string, userId: string, userName: string, id: string, body: string) {
    const r = await prisma.clientRequest.findFirst({ where: { id, orgId } });
    if (!r) throw new NotFoundError("Request", id);
    const existing = r.comments ? JSON.parse(r.comments) : [];
    existing.push({ at: new Date().toISOString(), userId, userName, body });
    await prisma.clientRequest.update({ where: { id }, data: { comments: JSON.stringify(existing) } });
    return prisma.clientRequest.findUnique({ where: { id } });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Events
// ──────────────────────────────────────────────────────────────────────

export const EventService = {
  async list(orgId: string) {
    return prisma.marketingEvent.findMany({
      where: { orgId },
      include: { client: true, registrations2: true, _count: { select: { registrations2: true } } },
      orderBy: { startAt: "desc" }
    });
  },
  async get(orgId: string, id: string) {
    const e = await prisma.marketingEvent.findFirst({
      where: { id, orgId },
      include: { client: true, registrations2: { orderBy: { createdAt: "desc" } } }
    });
    if (!e) throw new NotFoundError("Event", id);
    return e;
  },
  async create(orgId: string, userId: string, input: {
    name: string; clientId?: string; type: string; city?: string; venue?: string;
    isOnline?: boolean; startAt: Date; endAt?: Date; capacity?: number; registrationLimit?: number;
  }) {
    const e = await prisma.marketingEvent.create({
      data: {
        orgId,
        clientId: input.clientId,
        name: input.name,
        type: input.type,
        city: input.city ?? null,
        venue: input.venue ?? null,
        isOnline: input.isOnline ?? false,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        capacity: input.capacity ?? null,
        registrationLimit: input.registrationLimit ?? null,
        status: "PLANNED"
      }
    });
    await audit(orgId, userId, "event.create", { entityType: "MarketingEvent", entityId: e.id });
    return e;
  },
  async transition(orgId: string, userId: string, id: string, to: string) {
    const e = await prisma.marketingEvent.findFirst({ where: { id, orgId } });
    if (!e) throw new NotFoundError("Event", id);
    const valid = EVENT_TRANSITIONS[e.status] ?? [];
    if (!valid.includes(to)) throw new ConflictError(`Cannot transition event from ${e.status} to ${to}`);
    await prisma.marketingEvent.update({ where: { id }, data: { status: to } });
    await audit(orgId, userId, "event.status_change", { entityType: "MarketingEvent", entityId: id, after: { status: to } });
    return prisma.marketingEvent.findUnique({ where: { id } });
  },
  async updateFunnel(orgId: string, userId: string, eventId: string, funnel: {
    registrations: number; attended: number; qualified: number; consultations: number; conversions: number; revenue: number;
  }) {
    const e = await prisma.marketingEvent.findFirst({ where: { id: eventId, orgId } });
    if (!e) throw new NotFoundError("Event", eventId);
    await prisma.marketingEvent.update({ where: { id: eventId }, data: funnel });
    await audit(orgId, userId, "event.funnel_update", { entityType: "MarketingEvent", entityId: eventId, after: funnel });
    return prisma.marketingEvent.findUnique({ where: { id: eventId } });
  },
  async addRegistration(orgId: string, userId: string, input: {
    eventId: string; name: string; email?: string; phone?: string; source?: string; utmSource?: string;
  }) {
    const e = await prisma.marketingEvent.findFirst({ where: { id: input.eventId, orgId } });
    if (!e) throw new NotFoundError("Event", input.eventId);
    await prisma.$transaction([
      prisma.registration.create({
        data: {
          eventId: input.eventId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          source: input.source ?? null,
          utmSource: input.utmSource ?? null
        }
      }),
      prisma.marketingEvent.update({
        where: { id: input.eventId },
        data: { registrations: { increment: 1 } }
      })
    ]);
    await audit(orgId, userId, "event.registration.create", { entityType: "Registration", entityId: input.eventId });
    return prisma.registration.findFirst({ where: { eventId: input.eventId }, orderBy: { createdAt: "desc" } });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Influencers
// ──────────────────────────────────────────────────────────────────────

export const InfluencerService = {
  async list(orgId: string) {
    return prisma.influencer.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } });
  },
  async get(orgId: string, id: string) {
    const i = await prisma.influencer.findFirst({
      where: { id, orgId },
      include: { leadEntries: true }
    });
    if (!i) throw new NotFoundError("Influencer", id);
    return i;
  },
  async create(orgId: string, userId: string, input: {
    name: string; handle: string; platform: string; niche?: string;
    audienceSize?: number; audienceGeo?: string; contractValue?: number; feeType?: string; notes?: string;
  }) {
    const i = await prisma.influencer.create({
      data: {
        orgId,
        name: input.name,
        handle: input.handle,
        platform: input.platform,
        niche: input.niche ?? null,
        audienceSize: input.audienceSize ?? null,
        audienceGeo: input.audienceGeo ?? null,
        contractValue: input.contractValue ?? null,
        feeType: input.feeType ?? null,
        notes: input.notes ?? null,
        active: true
      }
    });
    await audit(orgId, userId, "influencer.create", { entityType: "Influencer", entityId: i.id });
    return i;
  }
};

// ──────────────────────────────────────────────────────────────────────
// Experiments
// ──────────────────────────────────────────────────────────────────────

export const ExperimentService = {
  async list(orgId: string) {
    return prisma.experiment.findMany({
      where: { orgId },
      include: { client: true, campaign: true },
      orderBy: { createdAt: "desc" }
    });
  },
  async get(orgId: string, id: string) {
    const e = await prisma.experiment.findFirst({
      where: { id, orgId },
      include: { client: true, campaign: true }
    });
    if (!e) throw new NotFoundError("Experiment", id);
    return e;
  },
  async create(orgId: string, userId: string, input: {
    title: string; hypothesis: string; variable: string; control: string; treatment: string;
    audience?: string; budget?: number; durationDays: number; kpi: string; expectedResult?: string;
    clientId?: string; campaignId?: string;
  }) {
    const e = await prisma.experiment.create({
      data: {
        orgId,
        clientId: input.clientId,
        campaignId: input.campaignId,
        title: input.title,
        hypothesis: input.hypothesis,
        variable: input.variable,
        control: input.control,
        treatment: input.treatment,
        audience: input.audience ?? null,
        budget: input.budget ?? null,
        durationDays: input.durationDays,
        kpi: input.kpi,
        expectedResult: input.expectedResult ?? null,
        status: "PLANNED"
      }
    });
    await audit(orgId, userId, "experiment.create", { entityType: "Experiment", entityId: e.id });
    return e;
  },
  async transition(orgId: string, userId: string, id: string, to: string) {
    const e = await prisma.experiment.findFirst({ where: { id, orgId } });
    if (!e) throw new NotFoundError("Experiment", id);
    const valid = EXPERIMENT_TRANSITIONS[e.status] ?? [];
    if (!valid.includes(to)) throw new ConflictError(`Cannot transition experiment from ${e.status} to ${to}`);
    const data: any = { status: to };
    if (to === "RUNNING") data.startedAt = new Date();
    if (to === "COMPLETED") data.completedAt = new Date();
    await prisma.experiment.update({ where: { id }, data });
    await audit(orgId, userId, "experiment.status_change", { entityType: "Experiment", entityId: id, after: { status: to } });
    return prisma.experiment.findUnique({ where: { id } });
  },
  async recordResult(orgId: string, userId: string, id: string, actualResult: string, conclusion: string) {
    const e = await prisma.experiment.findFirst({ where: { id, orgId } });
    if (!e) throw new NotFoundError("Experiment", id);
    await prisma.experiment.update({
      where: { id },
      data: { actualResult, conclusion, status: "COMPLETED", completedAt: new Date() }
    });
    await audit(orgId, userId, "experiment.evaluate", { entityType: "Experiment", entityId: id, after: { actualResult, conclusion } });
    return prisma.experiment.findUnique({ where: { id } });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Reports
// ──────────────────────────────────────────────────────────────────────

export const ReportService = {
  async list(orgId: string) {
    return prisma.report.findMany({
      where: { orgId },
      include: { client: true },
      orderBy: { createdAt: "desc" }
    });
  },
  async get(orgId: string, id: string) {
    const r = await prisma.report.findFirst({
      where: { id, orgId },
      include: { client: true, campaign: true }
    });
    if (!r) throw new NotFoundError("Report", id);
    return r;
  },
  async create(orgId: string, userId: string, input: {
    clientId: string; title: string; periodStart: Date; periodEnd: Date;
  }) {
    const r = await prisma.report.create({
      data: {
        orgId,
        clientId: input.clientId,
        title: input.title,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: "DRAFT"
      }
    });
    await audit(orgId, userId, "report.create", { entityType: "Report", entityId: r.id });
    return r;
  },
  async save(orgId: string, userId: string, id: string, sections: Record<string, string | null | undefined>) {
    const r = await prisma.report.findFirst({ where: { id, orgId } });
    if (!r) throw new NotFoundError("Report", id);
    const data = Object.fromEntries(Object.entries(sections).filter(([_, v]) => v !== undefined));
    await prisma.report.update({ where: { id }, data });
    await audit(orgId, userId, "report.update", { entityType: "Report", entityId: id, after: data });
    return prisma.report.findUnique({ where: { id } });
  },
  async publish(orgId: string, userId: string, id: string) {
    const r = await prisma.report.findFirst({ where: { id, orgId } });
    if (!r) throw new NotFoundError("Report", id);
    await prisma.report.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    // Notify all client users of this report's client
    const members = await prisma.user.findMany({
      where: { memberships: { some: { orgId: r.clientId } } }
    });
    for (const m of members) {
      await prisma.notification.create({
        data: {
          orgId: r.orgId,
          userId: m.id,
          type: "report.published",
          title: `New report: ${r.title}`,
          message: "Your latest performance report has been published.",
          link: `/app/reports/${r.id}`,
          channel: "in-app"
        }
      });
    }
    await audit(orgId, userId, "report.publish", { entityType: "Report", entityId: id });
    return prisma.report.findUnique({ where: { id } });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Decisions
// ──────────────────────────────────────────────────────────────────────

export const DecisionService = {
  async list(orgId: string, opts?: { campaignId?: string }) {
    return prisma.decisionLog.findMany({
      where: { orgId, ...(opts?.campaignId ? { campaignId: opts.campaignId } : {}) },
      include: { client: true, campaign: true, author: true },
      orderBy: { createdAt: "desc" }
    });
  },
  async create(orgId: string, userId: string, input: {
    clientId?: string; campaignId?: string; decisionType: string;
    decision: string; reason: string; hypothesis?: string; expectedOutcome?: string;
  }) {
    const d = await prisma.decisionLog.create({
      data: {
        orgId,
        clientId: input.clientId,
        campaignId: input.campaignId,
        decisionType: input.decisionType,
        decision: input.decision,
        reason: input.reason,
        hypothesis: input.hypothesis ?? null,
        expectedOutcome: input.expectedOutcome ?? null,
        authorId: userId
      }
    });
    await audit(orgId, userId, "decision.create", { entityType: "DecisionLog", entityId: d.id });
    return d;
  }
};

// ──────────────────────────────────────────────────────────────────────
// Automations
// ──────────────────────────────────────────────────────────────────────

export const AutomationService = {
  async list(orgId: string) {
    return prisma.automation.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" }
    });
  },
  async create(orgId: string, userId: string, input: {
    name: string; description?: string; trigger: string; conditions: string; actions: string;
  }) {
    const a = await prisma.automation.create({
      data: {
        orgId,
        name: input.name,
        description: input.description ?? null,
        trigger: input.trigger,
        conditions: input.conditions,
        actions: input.actions,
        enabled: true
      }
    });
    await audit(orgId, userId, "automation.create", { entityType: "Automation", entityId: a.id });
    return a;
  },
  async toggle(orgId: string, userId: string, id: string) {
    const a = await prisma.automation.findFirst({ where: { id, orgId } });
    if (!a) throw new NotFoundError("Automation", id);
    await prisma.automation.update({ where: { id }, data: { enabled: !a.enabled } });
    await audit(orgId, userId, "automation.toggle", { entityType: "Automation", entityId: id, after: { enabled: !a.enabled } });
    return prisma.automation.findUnique({ where: { id } });
  }
};