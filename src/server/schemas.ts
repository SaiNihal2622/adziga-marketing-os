// Adziga — DTOs and Zod schemas
// All inputs cross this boundary. Page forms and API routes parse through these.

import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────
// ID / Pagination
// ──────────────────────────────────────────────────────────────────────

export const cuidSchema = z.string().min(1).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  range: z.enum(["7", "30", "90"]).default("30").transform(Number)
});

// ──────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1)
});

// ──────────────────────────────────────────────────────────────────────
// Onboarding
// ──────────────────────────────────────────────────────────────────────

export const onboardingStepSchema = z.object({
  step1Business: z.string().min(1).max(2000).optional(),
  step2Objectives: z.string().max(2000).optional(),
  step3Audience: z.string().max(2000).optional(),
  step4Products: z.string().max(2000).optional(),
  step5Budget: z.string().max(2000).optional(),
  step6Channels: z.string().max(2000).optional(),
  step7BrandAssets: z.string().max(2000).optional(),
  step8Access: z.string().max(2000).optional(),
  step9Strategy: z.string().max(2000).optional(),
  step10Approval: z.string().max(2000).optional()
});

// ──────────────────────────────────────────────────────────────────────
// Client / Campaign / Lead / Creative / Strategy
// ──────────────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(50).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  businessModel: z.string().max(50).optional().nullable(),
  monthlyBudget: z.coerce.number().min(0).optional().nullable()
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: cuidSchema,
  platform: z.enum(["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"]),
  objective: z.string().min(1).max(100),
  budget: z.coerce.number().min(0).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable()
});

export const updateCampaignStatusSchema = z.object({
  id: cuidSchema,
  to: z.enum(["DRAFT", "INTERNAL_REVIEW", "CLIENT_APPROVAL", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
});

export const createLeadSchema = z.object({
  clientId: cuidSchema,
  campaignId: cuidSchema.optional(),
  name: z.string().max(200).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  source: z.enum(["META_AD", "GOOGLE_AD", "ORGANIC", "REFERRAL", "INFLUENCER", "EVENT", "WHATSAPP", "EMAIL", "DIRECT"]),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(200).optional().nullable(),
  utmContent: z.string().max(200).optional().nullable(),
  clickId: z.string().max(200).optional().nullable(),
  landingPage: z.string().url().optional().nullable().or(z.literal("")),
  score: z.coerce.number().int().min(0).max(100).default(0)
});

export const updateLeadSchema = z.object({
  id: cuidSchema,
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON", "LOST"]),
  score: z.coerce.number().int().min(0).max(100),
  qualificationData: z.string().max(4000).optional().nullable(),
  revenue: z.coerce.number().min(0).optional()
});

export const createCreativeSchema = z.object({
  name: z.string().min(1).max(200),
  campaignId: cuidSchema.optional(),
  format: z.enum(["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "TEXT", "UGC"]),
  platform: z.enum(["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"]),
  hook: z.string().max(500).optional(),
  headline: z.string().max(500).optional(),
  primaryCopy: z.string().max(5000).optional(),
  cta: z.string().max(200).optional(),
  creator: z.string().max(200).optional(),
  audience: z.string().max(200).optional()
});

export const createStrategySchema = z.object({
  title: z.string().min(1).max(200),
  clientId: cuidSchema.optional(),
  businessObjective: z.string().max(2000).optional(),
  targetAudience: z.string().max(2000).optional(),
  market: z.string().max(200).optional(),
  offer: z.string().max(2000).optional(),
  positioning: z.string().max(2000).optional(),
  campaignObjective: z.string().max(200).optional(),
  channels: z.string().max(500).optional(),
  budget: z.coerce.number().min(0).optional(),
  timeline: z.string().max(200).optional(),
  creativeStrategy: z.string().max(2000).optional(),
  leadStrategy: z.string().max(2000).optional(),
  conversionStrategy: z.string().max(2000).optional(),
  kpis: z.string().max(1000).optional(),
  successCriteria: z.string().max(2000).optional(),
  risks: z.string().max(2000).optional(),
  assumptions: z.string().max(2000).optional()
});

export const createStrategyVersionSchema = z.object({
  parentId: cuidSchema,
  changeReason: z.string().min(1).max(2000)
});

export const transitionStrategySchema = z.object({
  id: cuidSchema,
  to: z.enum(["INTERNAL_REVIEW", "CLIENT_APPROVAL", "APPROVED", "ARCHIVED"])
});

// ──────────────────────────────────────────────────────────────────────
// Tasks / Requests / Events / Influencers / Experiments
// ──────────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.coerce.date().optional().nullable(),
  assigneeId: cuidSchema.optional(),
  clientId: cuidSchema.optional()
});

export const createClientRequestSchema = z.object({
  clientId: cuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  category: z.enum(["CAMPAIGN_CHANGE", "BUDGET", "CREATIVE", "REPORTING", "MEETING", "STRATEGY", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM")
});

export const transitionRequestSchema = z.object({
  id: cuidSchema,
  to: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(2000).optional()
});

export const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: cuidSchema.optional(),
  type: z.enum(["WEBINAR", "WORKSHOP", "ROUNDTABLE", "INVESTOR_BRIEFING", "PRIVATE_BRIEFING", "OFFLINE_EVENT", "CONFERENCE"]),
  city: z.string().max(100).optional(),
  venue: z.string().max(200).optional(),
  isOnline: z.coerce.boolean().default(false),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  registrationLimit: z.coerce.number().int().min(0).optional()
});

export const eventFunnelUpdateSchema = z.object({
  eventId: cuidSchema,
  registrations: z.coerce.number().int().min(0),
  attended: z.coerce.number().int().min(0),
  qualified: z.coerce.number().int().min(0),
  consultations: z.coerce.number().int().min(0),
  conversions: z.coerce.number().int().min(0),
  revenue: z.coerce.number().min(0)
});

export const eventRegistrationSchema = z.object({
  eventId: cuidSchema,
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  utmSource: z.string().max(100).optional()
});

export const createInfluencerSchema = z.object({
  name: z.string().min(1).max(200),
  handle: z.string().min(1).max(200),
  platform: z.enum(["INSTAGRAM", "YOUTUBE", "LINKEDIN", "TWITTER", "TIKTOK", "OTHER"]),
  niche: z.string().max(200).optional(),
  audienceSize: z.coerce.number().int().min(0).optional(),
  audienceGeo: z.string().max(200).optional(),
  contractValue: z.coerce.number().min(0).optional(),
  feeType: z.string().max(50).optional(),
  notes: z.string().max(2000).optional()
});

export const createExperimentSchema = z.object({
  title: z.string().min(1).max(200),
  hypothesis: z.string().min(1).max(2000),
  variable: z.string().min(1).max(200),
  control: z.string().min(1).max(2000),
  treatment: z.string().min(1).max(2000),
  audience: z.string().max(200).optional(),
  budget: z.coerce.number().min(0).optional(),
  durationDays: z.coerce.number().int().min(1).max(365).default(14),
  kpi: z.string().min(1).max(100),
  expectedResult: z.string().max(200).optional(),
  clientId: cuidSchema.optional(),
  campaignId: cuidSchema.optional()
});

export const experimentResultSchema = z.object({
  id: cuidSchema,
  actualResult: z.string().max(200).optional(),
  conclusion: z.enum(["Confirmed", "Partially Confirmed", "Refuted", "Inconclusive"]).optional()
});

// ──────────────────────────────────────────────────────────────────────
// Reports / Decisions / Automations / Notifications
// ──────────────────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  clientId: cuidSchema,
  title: z.string().min(1).max(200),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date()
});

export const saveReportSchema = z.object({
  id: cuidSchema,
  executiveSummary: z.string().max(10000).optional(),
  performance: z.string().max(10000).optional(),
  campaignAnalysis: z.string().max(10000).optional(),
  funnel: z.string().max(10000).optional(),
  leadQuality: z.string().max(10000).optional(),
  creativePerformance: z.string().max(10000).optional(),
  recommendations: z.string().max(10000).optional(),
  nextActions: z.string().max(10000).optional()
});

export const createDecisionSchema = z.object({
  clientId: cuidSchema.optional(),
  campaignId: cuidSchema.optional(),
  decisionType: z.enum(["BUDGET_CHANGE", "CREATIVE_CHANGE", "AUDIENCE_CHANGE", "CHANNEL_CHANGE", "PAUSE_CAMPAIGN", "LAUNCH_CAMPAIGN", "SCALE_CAMPAIGN", "STRATEGY_UPDATE", "EXPERIMENT", "OTHER"]),
  decision: z.string().min(1).max(2000),
  reason: z.string().min(1).max(2000),
  hypothesis: z.string().max(2000).optional(),
  expectedOutcome: z.string().max(2000).optional()
});

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  trigger: z.enum(["lead.created", "lead.status_change", "campaign.spend_threshold", "report.published", "client_request.submitted", "integration.health_changed"]),
  conditions: z.string().default("{}"),
  actions: z.string().default("[]")
});

// ──────────────────────────────────────────────────────────────────────
// Phase 1/2/3/4
// ──────────────────────────────────────────────────────────────────────

export const leadScoringSchema = z.object({
  unscoredOnly: z.coerce.boolean().default(true),
  clientId: cuidSchema.optional()
});

export const strategyRecommendSchema = z.object({
  industry: z.string().min(1).max(100),
  objective: z.enum(["lead_gen", "awareness", "conversion", "revenue"]),
  monthlyBudget: z.coerce.number().min(1000),
  region: z.enum(["IN", "US", "GLOBAL"]).default("IN"),
  clientId: cuidSchema.optional(),
  audience: z.object({
    tier: z.string().optional(),
    b2b_b2c: z.string().optional(),
    ageMin: z.coerce.number().int().optional(),
    ageMax: z.coerce.number().int().optional()
  }).optional()
});

export const contentSuggestSchema = z.object({
  industry: z.string().min(1).max(100),
  audience: z.string().max(200),
  platform: z.enum(["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"]),
  goal: z.enum(["lead_gen", "awareness", "conversion", "revenue"])
});

export const orchestrationPlanSchema = z.object({
  clientId: cuidSchema.optional(),
  goalType: z.enum(["lead_gen", "awareness", "conversion", "revenue"]),
  goalQuantity: z.coerce.number().int().min(1),
  goalMetric: z.enum(["qualified_leads", "impressions", "customers", "revenue_inr"]).default("qualified_leads"),
  goalDeadline: z.coerce.date(),
  goalNotes: z.string().max(2000).optional()
});

export const orchestrationTransitionSchema = z.object({
  planId: cuidSchema,
  action: z.enum(["submit_internal_review", "submit_client_approval", "approve", "cancel", "fail", "deploy"])
});

export const askAssistantSchema = z.object({
  question: z.string().min(1).max(2000),
  clientId: cuidSchema.optional()
});

export const searchQuerySchema = z.object({
  q: z.string().min(2).max(200)
});

export const runJobSchema = z.object({
  name: z.enum(["automations.tick", "campaign.health_check", "intelligence.recompute", "integration.health_check"])
});

// â”€â”€â”€ Creatives library â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const creativeFormatSchema = z.enum([
  "IMAGE",
  "VIDEO",
  "CAROUSEL",
  "STORY",
  "REEL",
  "TEXT",
  "UGC",
  "AUDIO"
]);

export const creativePlatformSchema = z.enum([
  "META",
  "GOOGLE",
  "WHATSAPP",
  "EMAIL",
  "INFLUENCER",
  "LINKEDIN",
  "YOUTUBE",
  "INSTAGRAM",
  "TWITTER",
  "EVENT",
  "GENERIC"
]);

export const creativeSourceSchema = z.enum([
  "AI_GENERATED", // produced by Gemini / image model in our pipeline
  "CLIENT_UPLOAD", // uploaded by the client
  "DESIGNER",      // uploaded by an Adziga designer or freelancer
  "STOCK",         // licensed stock asset
  "USER_TEMPLATE"  // built from a template by the team
]);

export const createCreativeV2Schema = z.object({
  campaignId: cuidSchema.optional(),
  clientId: cuidSchema.optional(),
  name: z.string().min(1).max(200),
  format: creativeFormatSchema,
  platform: creativePlatformSchema,
  hook: z.string().max(400).optional(),
  headline: z.string().max(200).optional(),
  primaryCopy: z.string().max(4000).optional(),
  cta: z.string().max(80).optional(),
  audience: z.string().max(200).optional(),
  source: creativeSourceSchema.default("CLIENT_UPLOAD"),
  creator: z.string().max(120).optional(),
  mediaUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional()
});

export const updateCreativeSchema = createCreativeV2Schema.partial();

export const creativeStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED"
]);

export const creativeTransitionSchema = z.object({
  to: creativeStatusSchema,
  note: z.string().max(1000).optional()
});

export const listCreativesSchema = z.object({
  campaignId: cuidSchema.optional(),
  clientId: cuidSchema.optional(),
  status: creativeStatusSchema.optional(),
  format: creativeFormatSchema.optional(),
  platform: creativePlatformSchema.optional(),
  source: creativeSourceSchema.optional(),
  q: z.string().max(200).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional()
});

// AI generation: caption + image
export const generateCopySchema = z.object({
  campaignId: cuidSchema.optional(),
  clientId: cuidSchema.optional(),
  platform: creativePlatformSchema.default("META"),
  format: creativeFormatSchema.default("IMAGE"),
  brief: z.string().min(5).max(1000), // e.g. "5 captions for bridal saree Instagram carousel"
  tone: z.enum(["luxury", "playful", "trustworthy", "bold", "educational", "urgent"]).default("luxury"),
  count: z.coerce.number().int().min(1).max(10).default(3)
});

export const generateImageSchema = z.object({
  campaignId: cuidSchema.optional(),
  clientId: cuidSchema.optional(),
  platform: creativePlatformSchema.default("META"),
  brief: z.string().min(5).max(1000), // what the image should depict
  style: z.enum(["photoreal", "studio", "lifestyle", "ugc_phone_shot", "flat_lay", "infographic"]).default("studio"),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).default("1:1")
});

// â”€â”€â”€ Designer briefs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const briefStatusSchema = z.enum([
  "OPEN",
  "CLAIMED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DELIVERED",
  "ARCHIVED"
]);

export const briefPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export const createBriefSchema = z.object({
  clientId: cuidSchema.optional(),
  campaignId: cuidSchema.optional(),
  title: z.string().min(1).max(200),
  brief: z.string().min(10).max(8000),
  format: creativeFormatSchema,
  platform: creativePlatformSchema,
  priority: briefPrioritySchema.default("NORMAL"),
  dueDate: z.string().datetime().optional().nullable(),
  referenceUrls: z.array(z.string().url()).max(20).default([]),
  copyDirection: z.string().max(2000).optional(),
  assigneeId: cuidSchema.optional()
});

export const updateBriefSchema = createBriefSchema.partial();

export const listBriefsSchema = z.object({
  clientId: cuidSchema.optional(),
  campaignId: cuidSchema.optional(),
  status: briefStatusSchema.optional(),
  assigneeId: cuidSchema.optional(),
  priority: briefPrioritySchema.optional(),
  q: z.string().max(200).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional()
});

export const claimBriefSchema = z.object({});

export const deliverBriefSchema = z.object({
  assetUrl: z.string().url(),
  note: z.string().max(2000).optional()
});

export const transitionBriefSchema = z.object({
  to: briefStatusSchema,
  note: z.string().max(2000).optional()
});

