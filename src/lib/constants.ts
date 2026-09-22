// Adziga - TS-level enum-like constants (SQLite doesn't support enums)
// These are the source of truth for string values used across the app.

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  FOUNDER: "FOUNDER",
  ADMIN: "ADMIN",
  MARKETING_MANAGER: "MARKETING_MANAGER",
  CAMPAIGN_MANAGER: "CAMPAIGN_MANAGER",
  SALES: "SALES",
  FINANCE: "FINANCE",
  CONTENT: "CONTENT",
  DESIGNER: "DESIGNER",
  FREELANCER: "FREELANCER",
  CLIENT_ADMIN: "CLIENT_ADMIN",
  CLIENT_MEMBER: "CLIENT_MEMBER"
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  FOUNDER: "Founder / CEO",
  ADMIN: "Admin",
  MARKETING_MANAGER: "Marketing Manager",
  CAMPAIGN_MANAGER: "Campaign Manager",
  SALES: "Sales",
  FINANCE: "Finance",
  CONTENT: "Content Team",
  DESIGNER: "Designer",
  FREELANCER: "Freelancer",
  CLIENT_ADMIN: "Client Admin",
  CLIENT_MEMBER: "Client Member"
};

export const OrgTier = {
  FREE: "FREE",
  PRO: "PRO",
  ZIGA_PLUS: "ZIGA_PLUS"
} as const;
export type OrgTier = (typeof OrgTier)[keyof typeof OrgTier];

export const TIER_LABELS: Record<OrgTier, string> = {
  FREE: "Free - Marketing Companion AI",
  PRO: "Pro - Execution & Automation",
  ZIGA_PLUS: "Ziga Plus - Enterprise"
};

export const TIER_RANK: Record<OrgTier, number> = { FREE: 0, PRO: 1, ZIGA_PLUS: 2 };

export const TIER_FEATURES: Record<OrgTier, string[]> = {
  FREE: [
    "Marketing Companion AI",
    "KPI explanations",
    "Campaign analysis",
    "Basic recommendations",
    "Marketing planning"
  ],
  PRO: [
    "Everything in Free",
    "Campaign management",
    "Meta / Google / WhatsApp integrations",
    "Automated workflows",
    "Reporting & analytics",
    "Lead management & CRM",
    "Creative workflows"
  ],
  ZIGA_PLUS: [
    "Everything in Pro",
    "Advanced orchestration",
    "Enterprise analytics",
    "AI strategy intelligence",
    "Dedicated human expert support",
    "Custom integrations",
    "Advanced permissions & governance"
  ]
};

// Tier-gated capabilities. Returns true if `tier` satisfies the requirement.
export function hasFeature(orgTier: OrgTier, required: OrgTier): boolean {
  return TIER_RANK[orgTier] >= TIER_RANK[required];
}

export const Platform = {
  META: "META",
  GOOGLE: "GOOGLE",
  YOUTUBE: "YOUTUBE",
  INSTAGRAM: "INSTAGRAM",
  WHATSAPP: "WHATSAPP",
  LINKEDIN: "LINKEDIN",
  TWITTER: "TWITTER",
  EMAIL: "EMAIL",
  INFLUENCER: "INFLUENCER",
  EVENT: "EVENT"
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const PLATFORM_LABELS: Record<Platform, string> = {
  META: "Meta Ads",
  GOOGLE: "Google Ads",
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter / X",
  EMAIL: "Email",
  INFLUENCER: "Influencer",
  EVENT: "Event"
};

export const CampaignStatus = {
  DRAFT: "DRAFT",
  INTERNAL_REVIEW: "INTERNAL_REVIEW",
  CLIENT_APPROVAL: "CLIENT_APPROVAL",
  READY: "READY",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED"
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal Review",
  CLIENT_APPROVAL: "Client Approval",
  READY: "Ready",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived"
};

export const ClientStatus = {
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CHURNED: "CHURNED"
} as const;
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CHURNED: "Churned"
};

export const StrategyStatus = {
  DRAFT: "DRAFT",
  INTERNAL_REVIEW: "INTERNAL_REVIEW",
  CLIENT_APPROVAL: "CLIENT_APPROVAL",
  APPROVED: "APPROVED",
  ARCHIVED: "ARCHIVED"
} as const;
export type StrategyStatus = (typeof StrategyStatus)[keyof typeof StrategyStatus];

export const STRATEGY_STATUS_LABELS: Record<StrategyStatus, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal Review",
  CLIENT_APPROVAL: "Client Approval",
  APPROVED: "Approved",
  ARCHIVED: "Archived"
};

export const LeadStatus = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  PROPOSAL: "PROPOSAL",
  WON: "WON",
  LOST: "LOST"
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  MEETING_SCHEDULED: "Meeting Scheduled",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost"
};

// Lifecycle ordering for pipeline views
export const LEAD_LIFECYCLE_ORDER: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.MEETING_SCHEDULED,
  LeadStatus.PROPOSAL,
  LeadStatus.WON
];

export const LeadSource = {
  META_AD: "META_AD",
  GOOGLE_AD: "GOOGLE_AD",
  ORGANIC: "ORGANIC",
  REFERRAL: "REFERRAL",
  INFLUENCER: "INFLUENCER",
  EVENT: "EVENT",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  DIRECT: "DIRECT"
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const CreativeFormat = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  CAROUSEL: "CAROUSEL",
  STORY: "STORY",
  REEL: "REEL",
  TEXT: "TEXT",
  UGC: "UGC"
} as const;
export type CreativeFormat = (typeof CreativeFormat)[keyof typeof CreativeFormat];

export const CreativeStatus = {
  DRAFT: "DRAFT",
  REVIEW: "REVIEW",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED"
} as const;
export type CreativeStatus = (typeof CreativeStatus)[keyof typeof CreativeStatus];

export const CREATIVE_STATUS_LABELS: Record<CreativeStatus, string> = {
  DRAFT: "Draft",
  REVIEW: "Review",
  APPROVED: "Approved",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived"
};

export const RequestStatus = {
  SUBMITTED: "SUBMITTED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_CLIENT: "WAITING_CLIENT",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED"
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_CLIENT: "Waiting Client",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

export const RequestPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URRGENT" as any // intentional typo guard
} as const;
export type RequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent"
};

export const RequestCategory = {
  CAMPAIGN_CHANGE: "CAMPAIGN_CHANGE",
  BUDGET: "BUDGET",
  CREATIVE: "CREATIVE",
  REPORTING: "REPORTING",
  MEETING: "MEETING",
  STRATEGY: "STRATEGY",
  OTHER: "OTHER"
} as const;
export type RequestCategory = (typeof RequestCategory)[keyof typeof RequestCategory];

export const REQUEST_CATEGORY_LABELS: Record<RequestCategory, string> = {
  CAMPAIGN_CHANGE: "Campaign Change",
  BUDGET: "Budget",
  CREATIVE: "Creative",
  REPORTING: "Reporting",
  MEETING: "Meeting",
  STRATEGY: "Strategy",
  OTHER: "Other"
};

export const ExperimentStatus = {
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
} as const;
export type ExperimentStatus = (typeof ExperimentStatus)[keyof typeof ExperimentStatus];

export const DecisionType = {
  BUDGET_CHANGE: "BUDGET_CHANGE",
  CREATIVE_CHANGE: "CREATIVE_CHANGE",
  AUDIENCE_CHANGE: "AUDIENCE_CHANGE",
  CHANNEL_CHANGE: "CHANNEL_CHANGE",
  PAUSE_CAMPAIGN: "PAUSE_CAMPAIGN",
  LAUNCH_CAMPAIGN: "LAUNCH_CAMPAIGN",
  SCALE_CAMPAIGN: "SCALE_CAMPAIGN",
  STRATEGY_UPDATE: "STRATEGY_UPDATE",
  EXPERIMENT: "EXPERIMENT",
  OTHER: "OTHER"
} as const;
export type DecisionType = (typeof DecisionType)[keyof typeof DecisionType];

export const EventType = {
  WEBINAR: "WEBINAR",
  WORKSHOP: "WORKSHOP",
  ROUNDTABLE: "ROUNDTABLE",
  INVESTOR_BRIEFING: "INVESTOR_BRIEFING",
  PRIVATE_BRIEFING: "PRIVATE_BRIEFING",
  OFFLINE_EVENT: "OFFLINE_EVENT",
  CONFERENCE: "CONFERENCE"
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEBINAR: "Webinar",
  WORKSHOP: "Workshop",
  ROUNDTABLE: "Roundtable",
  INVESTOR_BRIEFING: "Investor Briefing",
  PRIVATE_BRIEFING: "Private Briefing",
  OFFLINE_EVENT: "Offline Event",
  CONFERENCE: "Conference"
};

export const EventStatus = {
  PLANNED: "PLANNED",
  REGISTRATION_OPEN: "REGISTRATION_OPEN",
  REGISTRATION_CLOSED: "REGISTRATION_CLOSED",
  LIVE: "LIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  PLANNED: "Planned",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

export const InfluencerPlatform = {
  INSTAGRAM: "INSTAGRAM",
  YOUTUBE: "YOUTUBE",
  LINKEDIN: "LINKEDIN",
  TWITTER: "TWITTER",
  TIKTOK: "TIKTOK",
  OTHER: "OTHER"
} as const;
export type InfluencerPlatform = (typeof InfluencerPlatform)[keyof typeof InfluencerPlatform];

export const INFLUENCER_PLATFORM_LABELS: Record<InfluencerPlatform, string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter / X",
  TIKTOK: "TikTok",
  OTHER: "Other"
};

export const IntegrationStatus = {
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  FAILED: "FAILED",
  DISABLED: "DISABLED"
} as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

export const AIInteractionMode = {
  ASSISTANT: "ASSISTANT",
  RECOMMEND: "RECOMMEND",
  AUTOMATE: "AUTOMATE"
} as const;
export type AIInteractionMode = (typeof AIInteractionMode)[keyof typeof AIInteractionMode];

// RBAC: which roles can access which route prefix
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: ["*"],
  FOUNDER: ["*"],
  ADMIN: ["*"],
  MARKETING_MANAGER: [
    "clients:read",
    "campaigns:*",
    "leads:read",
    "creatives:*",
    "strategy:*",
    "events:*",
    "influencers:*",
    "experiments:*",
    "reports:*",
    "analytics:read",
    "tasks:*",
    "requests:read",
    "requests:write",
    "ai:use"
  ],
  CAMPAIGN_MANAGER: [
    "campaigns:*",
    "creatives:read",
    "creatives:write",
    "analytics:read",
    "tasks:*",
    "ai:use"
  ],
  SALES: ["leads:*", "clients:read", "ai:use", "requests:*"],
  FINANCE: ["billing:*", "invoices:*", "reports:read", "analytics:read"],
  CONTENT: ["creatives:*", "campaigns:read", "briefs:write"],
  DESIGNER: ["creatives:read", "creatives:write", "briefs:read", "briefs:write", "campaigns:read"],
  FREELANCER: ["creatives:read", "creatives:write", "briefs:read", "briefs:write"],
  CLIENT_ADMIN: [
    "client.dashboard",
    "client.campaigns",
    "client.leads",
    "client.reports",
    "client.requests",
    "client.creatives",
    "client.events",
    "client.ai"
  ],
  CLIENT_MEMBER: ["client.dashboard", "client.reports", "client.ai"]
};

export function canAccess(role: Role, action: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes("*")) return true;
  if (perms.includes(action)) return true;
  const [resource] = action.split(":");
  return perms.includes(`${resource}:*`);
}

// Which routes a given role can see in the sidebar
export function navRoutesForRole(role: Role): { client: string[]; operator: string[] } {
  if (role === Role.SUPER_ADMIN || role === Role.FOUNDER || role === Role.ADMIN) {
    return {
      operator: [
        "Overview",
        "Orchestrate",
        "Agents",
        "Intelligence",
        "Connectors",
        "Clients",
        "Campaigns",
        "Strategy",
        "Creatives",
        "Leads",
        "CRM",
        "Events",
        "Influencers",
        "Experiments",
        "Analytics",
        "Reports",
        "Tasks",
        "Requests",
        "Automations",
        "AI Assistant",
        "Admin",
        "Approvals",
        "Audit",
        "Integrations"
      ],
      client: []
    };
  }
  if (
    role === Role.MARKETING_MANAGER ||
    role === Role.CAMPAIGN_MANAGER ||
    role === Role.SALES ||
    role === Role.CONTENT
  ) {
    return {
      operator: [
        "Overview",
        "Orchestrate",
        "Intelligence",
        "Clients",
        "Campaigns",
        "Strategy",
        "Creatives",
        "Leads",
        "Events",
        "Influencers",
        "Experiments",
        "Analytics",
        "Reports",
        "Tasks",
        "Automations",
        "AI Assistant"
      ],
      client: []
    };
  }
  if (role === Role.FINANCE) {
    return {
      operator: ["Reports", "Analytics", "Billing"],
      client: []
    };
  }
  // CLIENT_ADMIN and CLIENT_MEMBER
  return {
    operator: [],
    client: [
      "Overview",
      "Agents",
      "Campaigns",
      "Leads",
      "Creatives",
      "Strategy",
      "Events",
      "Reports",
      "AI Assistant",
      "Requests"
    ]
  };
}