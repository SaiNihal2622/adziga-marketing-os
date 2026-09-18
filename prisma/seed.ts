// Adziga seed data — realistic, multi-tenant, full dataset
// Run: npx prisma db push --skip-generate && npx tsx prisma/seed.ts
// Note: SQLite-friendly, uses cuid ids from Prisma @default(cuid())

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBenchmarks } from "../src/lib/intelligence/strategy-engine";
import { recomputeContentPatterns } from "../src/lib/intelligence/content-engine";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Clearing existing data");
  // Order matters due to FK constraints
  await prisma.automationRun.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.aIInteraction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.clientRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.decisionLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.experiment.deleteMany();
  await prisma.influencer.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.marketingEvent.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.revenue.deleteMany();
  await prisma.adSpend.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.onboarding.deleteMany();
  await prisma.client.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billingAccount.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("→ Hashing passwords");
  const hash = (pw: string) => bcrypt.hashSync(pw, 8);

  // ── 1. Adziga internal org ────────────────────────────────────────────────
  console.log("→ Creating Adziga internal org + users");
  const adzigaOrg = await prisma.organization.create({
    data: {
      name: "Adziga",
      slug: "adziga",
      tier: "ZIGA_PLUS",
      industry: "Advertising Technology",
      website: "https://adziga.in",
      isAdzigaInternal: true
    }
  });

  // ── 2. Client orgs (multi-tenant demo) ────────────────────────────────────
  console.log("→ Creating client organizations");
  const acmeOrg = await prisma.organization.create({
    data: {
      name: "Acme Realty",
      slug: "acme-realty",
      tier: "PRO",
      industry: "Real Estate",
      website: "https://acme-realty.example.in"
    }
  });
  const finriseOrg = await prisma.organization.create({
    data: {
      name: "FinRise Capital",
      slug: "finrise",
      tier: "PRO",
      industry: "Financial Services",
      website: "https://finrise.example.in"
    }
  });

  // ── 3. Users (one per role) ───────────────────────────────────────────────
  console.log("→ Creating users");
  const users = await Promise.all([
    prisma.user.create({ data: { email: "super@adziga.in", name: "Sai (Super Admin)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "founder@adziga.in", name: "Nihal (Founder)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "admin@adziga.in", name: "Ops Admin", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "mm@adziga.in", name: "Maya (Marketing Manager)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "cm@adziga.in", name: "Arjun (Campaign Manager)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "sales@adziga.in", name: "Priya (Sales)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "finance@adziga.in", name: "Vikram (Finance)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "content@adziga.in", name: "Riya (Content)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "client@acme.in", name: "Rohan (Acme Client Admin)", passwordHash: hash("adziga123") } }),
    prisma.user.create({ data: { email: "client@finrise.in", name: "Anika (FinRise Client Admin)", passwordHash: hash("adziga123") } })
  ]);

  const [superU, founderU, adminU, mmU, cmU, salesU, financeU, contentU, acmeClientU, finriseClientU] = users;

  // ── 4. Memberships ───────────────────────────────────────────────────────
  console.log("→ Linking users to organizations with roles");
  const memberships = [
    { userId: superU.id, orgId: adzigaOrg.id, role: "SUPER_ADMIN" },
    { userId: founderU.id, orgId: adzigaOrg.id, role: "FOUNDER" },
    { userId: adminU.id, orgId: adzigaOrg.id, role: "ADMIN" },
    { userId: mmU.id, orgId: adzigaOrg.id, role: "MARKETING_MANAGER" },
    { userId: cmU.id, orgId: adzigaOrg.id, role: "CAMPAIGN_MANAGER" },
    { userId: salesU.id, orgId: adzigaOrg.id, role: "SALES" },
    { userId: financeU.id, orgId: adzigaOrg.id, role: "FINANCE" },
    { userId: contentU.id, orgId: adzigaOrg.id, role: "CONTENT" },
    { userId: acmeClientU.id, orgId: acmeOrg.id, role: "CLIENT_ADMIN" },
    { userId: finriseClientU.id, orgId: finriseOrg.id, role: "CLIENT_ADMIN" }
  ];
  for (const m of memberships) {
    await prisma.orgMember.create({ data: m });
  }

  // ── 5. Clients (managed by Adziga org) ────────────────────────────────────
  console.log("→ Creating client accounts");
  const acmeClient = await prisma.client.create({
    data: {
      orgId: adzigaOrg.id,
      businessName: "Acme Realty",
      contactName: "Rohan Mehta",
      contactEmail: "rohan@acme-realty.example.in",
      contactPhone: "+91 98000 11111",
      industry: "Real Estate",
      websiteUrl: "https://acme-realty.example.in",
      city: "Mumbai",
      country: "India",
      businessModel: "B2C",
      monthlyBudget: 250000,
      status: "ACTIVE",
      tier: "PRO",
      contractStart: new Date("2026-04-01"),
      contractEnd: new Date("2027-03-31"),
      onboardingStep: 10,
      notes: "Special campaign workspace: Dubai Real Estate Investor Acquisition (500 registrations before Mar 15)"
    }
  });
  const finriseClient = await prisma.client.create({
    data: {
      orgId: adzigaOrg.id,
      businessName: "FinRise Capital",
      contactName: "Anika Sharma",
      contactEmail: "anika@finrise.example.in",
      contactPhone: "+91 98000 22222",
      industry: "Financial Services",
      websiteUrl: "https://finrise.example.in",
      city: "Bengaluru",
      country: "India",
      businessModel: "B2B",
      monthlyBudget: 180000,
      status: "ACTIVE",
      tier: "PRO",
      contractStart: new Date("2026-06-15"),
      onboardingStep: 10
    }
  });

  await prisma.onboarding.create({
    data: {
      clientId: acmeClient.id,
      step1Business: "Premium real-estate advisory for HNI/NRI buyers, focused on Dubai investments",
      step2Objectives: "Lead generation: 500 qualified Indian investors for Dubai projects by Mar 15",
      step3Audience: "HNI Indian investors, 35-55, Tier-1 cities, INR 2Cr+ investable",
      step4Products: "Dubai off-plan apartments, freehold villas, Golden Visa-linked investments",
      step5Budget: "INR 25L/month (Meta + Google + YouTube + Influencers + Events)",
      step6Channels: "Meta Ads, Google Ads, YouTube, Instagram creators, WhatsApp, Offline events",
      step7BrandAssets: "Brand book, pitch deck, project brochures, drone footage",
      step8Access: "Meta Business, Google Ads, WhatsApp Business, GA4, CRM",
      step9Strategy: "Multi-channel acquisition with unified attribution through investor events",
      step10Approval: "Approved by Acme on Apr 1, 2026",
      completedAt: new Date("2026-04-01")
    }
  });

  // ── 6. Strategies (versioned) ─────────────────────────────────────────────
  console.log("→ Creating strategies (with versions)");
  const acmeStrategyV1 = await prisma.strategy.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: acmeClient.id,
      title: "Dubai Real Estate — Q1 Investor Acquisition",
      version: 1,
      businessObjective: "Acquire 500 qualified Indian investors for Dubai projects",
      targetAudience: "HNI/NRI Indian investors, INR 2Cr+ investable",
      market: "Mumbai, Bengaluru, Delhi, Hyderabad",
      offer: "Free consultation + Dubai site visit package",
      positioning: "Premium, low-risk Dubai real-estate for Indian HNIs",
      campaignObjective: "Lead generation",
      channels: JSON.stringify(["META", "GOOGLE", "YOUTUBE", "INFLUENCER", "EVENT", "WHATSAPP"]),
      budget: 750000,
      timeline: "Apr 2026 — Mar 2027",
      creativeStrategy: "Founder-led video + investor testimonial carousel + city-specific landing pages",
      leadStrategy: "Qualification via WhatsApp + scheduled consultation",
      conversionStrategy: "1:1 consultation → site visit → booking",
      kpis: JSON.stringify({ qualifiedLeads: 500, cpl: 1500, cac: 25000, roas: 4 }),
      successCriteria: "500 registrations + 100 site visits + 25 bookings before Mar 15, 2027",
      risks: "Forex volatility; UAE regulatory shifts",
      assumptions: "Lead quality scales with webinar attendance",
      status: "APPROVED",
      changeReason: "Initial strategy",
      authorId: mmU.id,
      approverId: adminU.id,
      approvedAt: new Date("2026-04-02")
    }
  });
  await prisma.strategy.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: acmeClient.id,
      title: "Dubai Real Estate — Q1 Investor Acquisition",
      version: 2,
      parentId: acmeStrategyV1.id,
      businessObjective: "Acquire 500 qualified Indian investors for Dubai projects",
      targetAudience: "HNI/NRI Indian investors, INR 2Cr+ investable",
      market: "Mumbai, Bengaluru, Delhi, Hyderabad, Pune",
      offer: "Free consultation + Dubai site visit package + investor-only webinar series",
      positioning: "Premium, low-risk Dubai real-estate for Indian HNIs",
      campaignObjective: "Lead generation",
      channels: JSON.stringify(["META", "GOOGLE", "YOUTUBE", "INFLUENCER", "EVENT", "WHATSAPP"]),
      budget: 900000,
      timeline: "Apr 2026 — Mar 2027",
      creativeStrategy: "Founder-led video + investor testimonial carousel + city-specific landing pages + webinar promos",
      leadStrategy: "Qualification via WhatsApp + scheduled consultation + webinar funnel",
      conversionStrategy: "Webinar → 1:1 consultation → site visit → booking",
      kpis: JSON.stringify({ qualifiedLeads: 600, cpl: 1200, cac: 22000, roas: 4.5 }),
      successCriteria: "600 registrations + 150 site visits + 30 bookings before Mar 15, 2027",
      risks: "Forex volatility; UAE regulatory shifts",
      assumptions: "Webinar-attended leads convert 2x better than direct leads",
      status: "APPROVED",
      changeReason: "Added webinar channel after pilot showed 2x conversion vs cold leads",
      authorId: mmU.id,
      approverId: adminU.id,
      approvedAt: new Date("2026-06-15")
    }
  });

  const finriseStrategy = await prisma.strategy.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: finriseClient.id,
      title: "FinRise — Wealth Management Lead Gen",
      version: 1,
      businessObjective: "Generate qualified HNIs for portfolio advisory",
      campaignObjective: "Lead generation",
      channels: JSON.stringify(["META", "GOOGLE", "LINKEDIN"]),
      budget: 540000,
      kpis: JSON.stringify({ qualifiedLeads: 200, cpl: 800 }),
      status: "APPROVED",
      authorId: mmU.id,
      approverId: adminU.id,
      approvedAt: new Date("2026-07-01")
    }
  });

  // ── 7. Audiences ──────────────────────────────────────────────────────────
  console.log("→ Creating audiences");
  const dubaiInvestors = await prisma.audience.create({
    data: {
      orgId: adzigaOrg.id,
      name: "Dubai HNI Investors — Tier 1",
      description: "Indians 35-55 in Mumbai, Bengaluru, Delhi with HNI signals",
      size: 250000,
      ageMin: 35,
      ageMax: 55,
      locations: "Mumbai, Bengaluru, Delhi, Hyderabad, Pune",
      interests: "Real estate investing, NRI, Dubai, UAE",
      behavior: "Frequent international travelers, premium credit cards"
    }
  });
  const finriseHNI = await prisma.audience.create({
    data: {
      orgId: adzigaOrg.id,
      name: "FinRise HNI Salaried",
      size: 180000,
      ageMin: 32,
      ageMax: 50,
      locations: "Bengaluru, Mumbai, Pune",
      interests: "Wealth management, mutual funds, stocks",
      behavior: "Income > ₹50L p.a."
    }
  });

  // ── 8. Campaigns ─────────────────────────────────────────────────────────
  console.log("→ Creating campaigns (multiple statuses)");
  const acmeCampaigns = await Promise.all([
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        name: "Acme — Dubai Investor Acquisition (Meta)",
        platform: "META",
        objective: "Lead generation",
        budget: 250000,
        spent: 187500,
        startDate: new Date("2026-08-01"),
        status: "ACTIVE",
        health: "Healthy",
        impressions: 1840000n,
        reach: 720000n,
        clicks: 28500n,
        leads: 1240n,
        qualifiedLeads: 412n,
        customers: 18n,
        revenue: 4200000,
        utmSource: "meta",
        utmMedium: "paid",
        utmCampaign: "dubai-investor-q3"
      }
    }),
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        name: "Acme — Dubai Investor Acquisition (Google)",
        platform: "GOOGLE",
        objective: "Lead generation",
        budget: 180000,
        spent: 132000,
        startDate: new Date("2026-08-15"),
        status: "ACTIVE",
        health: "At Risk",
        impressions: 480000n,
        reach: 210000n,
        clicks: 9800n,
        leads: 410n,
        qualifiedLeads: 162n,
        customers: 7n,
        revenue: 1850000,
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "dubai-investor-search"
      }
    }),
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        name: "Acme — Webinar Series",
        platform: "EMAIL",
        objective: "Engagement",
        budget: 30000,
        spent: 22000,
        startDate: new Date("2026-09-01"),
        status: "ACTIVE",
        health: "Healthy",
        impressions: 24000n,
        clicks: 3200n,
        leads: 280n,
        qualifiedLeads: 195n,
        customers: 4n,
        revenue: 950000
      }
    }),
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        name: "Acme — Mumbai Offline Investor Briefing",
        platform: "EVENT",
        objective: "Conversion",
        budget: 50000,
        spent: 50000,
        startDate: new Date("2026-10-15"),
        status: "READY",
        health: "Healthy",
        impressions: 1200n,
        clicks: 0n,
        leads: 95n,
        qualifiedLeads: 80n,
        customers: 6n,
        revenue: 1400000
      }
    }),
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        name: "Acme — Q1 Awareness (Q4)",
        platform: "META",
        objective: "Awareness",
        budget: 100000,
        spent: 80000,
        startDate: new Date("2026-09-15"),
        endDate: new Date("2026-10-10"),
        status: "PAUSED",
        health: "Healthy",
        impressions: 2100000n,
        reach: 1100000n,
        clicks: 12400n,
        leads: 320n,
        qualifiedLeads: 45n
      }
    })
  ]);

  const finriseCampaigns = await Promise.all([
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        name: "FinRise — Wealth Advisory (Meta)",
        platform: "META",
        objective: "Lead generation",
        budget: 120000,
        spent: 92000,
        startDate: new Date("2026-08-01"),
        status: "ACTIVE",
        health: "Healthy",
        impressions: 980000n,
        reach: 410000n,
        clicks: 14200n,
        leads: 720n,
        qualifiedLeads: 248n,
        customers: 11n,
        revenue: 880000
      }
    }),
    prisma.campaign.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        name: "FinRise — LinkedIn B2B Outreach",
        platform: "LINKEDIN",
        objective: "Lead generation",
        budget: 60000,
        spent: 42000,
        startDate: new Date("2026-09-01"),
        status: "ACTIVE",
        health: "Healthy",
        impressions: 220000n,
        clicks: 4100n,
        leads: 180n,
        qualifiedLeads: 96n,
        customers: 4n,
        revenue: 320000
      }
    })
  ]);

  const allCampaigns = [...acmeCampaigns, ...finriseCampaigns];

  // ── 9. Ad Sets & Ads ──────────────────────────────────────────────────────
  console.log("→ Creating ad sets + ads");
  const toInt = (v: number) => Math.floor(v);
  for (const camp of allCampaigns.filter((c) => c.platform !== "EVENT" && c.platform !== "EMAIL")) {
    const adSet = await prisma.adSet.create({
      data: {
        campaignId: camp.id,
        name: `${camp.name} — Broad`,
        audience: dubaiInvestors.id,
        budget: (camp.budget ?? 0) * 0.6,
        spent: camp.spent * 0.6,
        impressions: BigInt(toInt(Number(camp.impressions) * 0.55)),
        reach: BigInt(toInt(Number(camp.reach) * 0.55)),
        clicks: BigInt(toInt(Number(camp.clicks) * 0.55)),
        leads: BigInt(toInt(Number(camp.leads) * 0.55)),
        status: camp.status === "PAUSED" ? "PAUSED" : "ACTIVE"
      }
    });
    await prisma.adSet.create({
      data: {
        campaignId: camp.id,
        name: `${camp.name} — Lookalike`,
        audience: dubaiInvestors.id,
        budget: (camp.budget ?? 0) * 0.4,
        spent: camp.spent * 0.4,
        impressions: BigInt(toInt(Number(camp.impressions) * 0.45)),
        reach: BigInt(toInt(Number(camp.reach) * 0.45)),
        clicks: BigInt(toInt(Number(camp.clicks) * 0.45)),
        leads: BigInt(toInt(Number(camp.leads) * 0.45)),
        status: camp.status === "PAUSED" ? "PAUSED" : "ACTIVE"
      }
    });
    await prisma.ad.create({
      data: {
        campaignId: camp.id,
        adSetId: adSet.id,
        name: `${camp.name} — Hero Video`,
        format: "VIDEO",
        impressions: BigInt(toInt(Number(camp.impressions) * 0.3)),
        clicks: BigInt(toInt(Number(camp.clicks) * 0.3)),
        spend: camp.spent * 0.3,
        leads: BigInt(toInt(Number(camp.leads) * 0.3)),
        ctr: 2.4,
        cpc: 28
      }
    });
  }

  // ── 10. Creatives ────────────────────────────────────────────────────────
  console.log("→ Creating creative library");
  await prisma.creative.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        campaignId: acmeCampaigns[0].id,
        name: "Dubai Skyline — Founder Story",
        format: "VIDEO",
        platform: "META",
        hook: "What if your next home was in Dubai?",
        headline: "Indian HNI's guide to Dubai real estate",
        primaryCopy: "Free consultation with our Dubai desk. Curated projects, full legal support.",
        cta: "Book Free Consultation",
        creator: "Acme Founders",
        audience: "HNI 35-55",
        impressions: 920000n,
        reach: 380000n,
        spend: 92000,
        ctr: 2.7,
        cpc: 26,
        leads: 620n,
        cpl: 148,
        conversions: 9n,
        revenue: 2100000,
        status: "ACTIVE"
      },
      {
        orgId: adzigaOrg.id,
        campaignId: acmeCampaigns[0].id,
        name: "Investor Testimonial Carousel",
        format: "CAROUSEL",
        platform: "META",
        hook: "3 Indians who bought Dubai property in 2026",
        headline: "Real stories. Real returns.",
        primaryCopy: "Hear from investors who diversified into Dubai this year.",
        cta: "See Stories",
        creator: "Acme Content Team",
        impressions: 540000n,
        reach: 240000n,
        spend: 58000,
        ctr: 1.9,
        cpc: 31,
        leads: 380n,
        cpl: 152,
        conversions: 6n,
        revenue: 1400000,
        status: "ACTIVE"
      },
      {
        orgId: adzigaOrg.id,
        campaignId: acmeCampaigns[1].id,
        name: "Search — Dubai Property Investment",
        format: "TEXT",
        platform: "GOOGLE",
        hook: "Dubai property from ₹1.2 Cr",
        headline: "Dubai Property Investment for Indians",
        primaryCopy: "Curated Dubai projects. Free consultation. End-to-end support.",
        cta: "Get Free Guide",
        creator: "Acme SEM Team",
        impressions: 280000n,
        reach: 240000n,
        spend: 62000,
        ctr: 2.1,
        cpc: 28,
        leads: 240n,
        cpl: 258,
        conversions: 4n,
        revenue: 920000,
        status: "ACTIVE"
      },
      {
        orgId: adzigaOrg.id,
        campaignId: finriseCampaigns[0].id,
        name: "FinRise — Retirement Planning Hero",
        format: "VIDEO",
        platform: "META",
        hook: "Most Indians retire broke. Here's the fix.",
        headline: "Wealth advisory for professionals 32-50",
        primaryCopy: "Personalized portfolio strategy from SEBI-registered advisors.",
        cta: "Book Portfolio Review",
        creator: "FinRise Marketing",
        impressions: 480000n,
        reach: 210000n,
        spend: 46000,
        ctr: 2.2,
        cpc: 22,
        leads: 360n,
        cpl: 128,
        conversions: 6n,
        revenue: 480000,
        status: "ACTIVE"
      }
    ]
  });

  // ── 11. Leads ────────────────────────────────────────────────────────────
  console.log("→ Creating leads across all lifecycle stages");
  const sources = ["META_AD", "GOOGLE_AD", "INFLUENCER", "EVENT", "WHATSAPP", "ORGANIC", "DIRECT"];
  const statuses = ["NEW", "CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON", "LOST"];
  const statusesWeights = [3, 4, 5, 4, 3, 2, 2]; // bias to qualified/meeting

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const leadsData: any[] = [];
  for (let i = 0; i < 240; i++) {
    const camp = pick(allCampaigns.filter((c) => c.platform !== "EVENT"));
    const source = camp.platform === "META" ? "META_AD" : camp.platform === "GOOGLE" ? "GOOGLE_AD" : pick(sources);
    let status = "NEW";
    let r = Math.random() * 25;
    if (r < 3) status = "NEW";
    else if (r < 7) status = "CONTACTED";
    else if (r < 12) status = "QUALIFIED";
    else if (r < 16) status = "MEETING_SCHEDULED";
    else if (r < 19) status = "PROPOSAL";
    else if (r < 21) status = "WON";
    else if (r < 23) status = "LOST";
    else status = "NEW";
    const isClient = camp.clientId === acmeClient.id;
    const city = pick(isClient ? ["Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Pune"] : ["Bengaluru", "Mumbai", "Pune", "Chennai"]);
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400_000);
    leadsData.push({
      orgId: adzigaOrg.id,
      clientId: camp.clientId,
      campaignId: camp.id,
      name: pick(["Rajesh K", "Priya S", "Anil M", "Sneha P", "Vivek R", "Neha G", "Karan T", "Divya N", "Amit B", "Pooja L", "Sandeep Y", "Ritu V"]),
      email: `lead${i}@example.in`,
      phone: `+91 9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`,
      city,
      source,
      utmSource: source === "META_AD" ? "meta" : source === "GOOGLE_AD" ? "google" : source.toLowerCase(),
      utmMedium: source.includes("AD") ? "paid" : "organic",
      utmCampaign: "dubai-q3",
      score: Math.floor(Math.random() * 100),
      status,
      ownerId: salesU.id,
      qualificationData: status !== "NEW" ? JSON.stringify({ budget: "₹2Cr+", timeline: "0-3 months" }) : null,
      revenue: status === "WON" ? Math.floor(Math.random() * 5e5) + 50000 : 0,
      wonAt: status === "WON" ? new Date(createdAt.getTime() + 7 * 86400_000) : null,
      lostAt: status === "LOST" ? new Date(createdAt.getTime() + 5 * 86400_000) : null,
      lastContactAt: status !== "NEW" ? new Date(createdAt.getTime() + 86400_000) : null,
      createdAt
    });
  }
  await prisma.lead.createMany({ data: leadsData });

  // Convert some WON leads to customers
  const wonLeads = await prisma.lead.findMany({ where: { status: "WON" }, take: 20 });
  for (const l of wonLeads) {
    await prisma.customer.create({
      data: {
        orgId: adzigaOrg.id,
        clientId: l.clientId,
        leadId: l.id,
        name: l.name ?? "Customer",
        email: l.email,
        phone: l.phone,
        revenue: l.revenue,
        acquiredAt: l.wonAt ?? new Date()
      }
    });
  }

  // ── 12. Events ───────────────────────────────────────────────────────────
  console.log("→ Creating events (offline + online)");
  await prisma.marketingEvent.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: acmeClient.id,
      name: "Dubai Real Estate Investor Briefing — Mumbai",
      type: "INVESTOR_BRIEFING",
      city: "Mumbai",
      venue: "Trident, Nariman Point",
      isOnline: false,
      startAt: new Date("2026-10-15T18:30:00"),
      endAt: new Date("2026-10-15T21:00:00"),
      capacity: 80,
      registrationLimit: 100,
      status: "REGISTRATION_OPEN",
      registrations: 95,
      attended: 0,
      qualified: 80,
      consultations: 60,
      conversions: 6,
      revenue: 1400000,
      notes: "Founder-led briefing + 3 case-study panels"
    }
  });
  await prisma.marketingEvent.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: acmeClient.id,
      name: "Dubai Real Estate Webinar — NRI Edition",
      type: "WEBINAR",
      isOnline: true,
      startAt: new Date("2026-09-20T19:00:00"),
      endAt: new Date("2026-09-20T20:00:00"),
      capacity: 500,
      status: "COMPLETED",
      registrations: 412,
      attended: 285,
      qualified: 240,
      consultations: 180,
      conversions: 8,
      revenue: 1900000,
      notes: "Highest-converting webinar so far"
    }
  });
  await prisma.marketingEvent.create({
    data: {
      orgId: adzigaOrg.id,
      clientId: finriseClient.id,
      name: "FinRise Wealth Workshop — Bengaluru",
      type: "WORKSHOP",
      city: "Bengaluru",
      venue: "The Leela, Palace",
      isOnline: false,
      startAt: new Date("2026-09-28T15:00:00"),
      endAt: new Date("2026-09-28T18:00:00"),
      capacity: 50,
      status: "COMPLETED",
      registrations: 60,
      attended: 42,
      qualified: 36,
      consultations: 28,
      conversions: 4,
      revenue: 320000
    }
  });

  // ── 13. Influencers ──────────────────────────────────────────────────────
  console.log("→ Creating influencer roster");
  await prisma.influencer.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        name: "Aanya Khurana",
        handle: "@aanyainvests",
        platform: "INSTAGRAM",
        niche: "Personal finance, real estate",
        audienceSize: 480000,
        audienceGeo: "India — Tier 1",
        contractValue: 250000,
        feeType: "hybrid",
        postsDelivered: 8,
        leadsCount: 312,
        qualifiedLeads: 180,
        conversions: 7,
        revenue: 1650000,
        notes: "Best performer on Dubai investor cohort"
      },
      {
        orgId: adzigaOrg.id,
        name: "Investor with Raj",
        handle: "@investorwithraj",
        platform: "YOUTUBE",
        niche: "Stock market, real estate",
        audienceSize: 720000,
        audienceGeo: "India",
        contractValue: 180000,
        feeType: "fixed",
        postsDelivered: 4,
        leadsCount: 240,
        qualifiedLeads: 142,
        conversions: 5,
        revenue: 1180000
      },
      {
        orgId: adzigaOrg.id,
        name: "FinFluencer — Meera",
        handle: "@meeratalksmoney",
        platform: "INSTAGRAM",
        niche: "Mutual funds, salaried HNI",
        audienceSize: 215000,
        audienceGeo: "India",
        contractValue: 95000,
        feeType: "performance",
        postsDelivered: 6,
        leadsCount: 180,
        qualifiedLeads: 96,
        conversions: 3,
        revenue: 240000
      }
    ]
  });

  // ── 14. Experiments ──────────────────────────────────────────────────────
  console.log("→ Creating experiments");
  await prisma.experiment.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        campaignId: acmeCampaigns[0].id,
        title: "Video hook: founder vs testimonial",
        hypothesis: "Founder-led hook will outperform testimonial-led hook on qualified-lead rate",
        variable: "creative_hook",
        control: JSON.stringify({ hook_type: "testimonial" }),
        treatment: JSON.stringify({ hook_type: "founder_led" }),
        audience: "HNI 35-55, Tier 1",
        budget: 80000,
        durationDays: 21,
        kpi: "qualified_lead_rate",
        expectedResult: "+15% qualified leads per impression",
        actualResult: "+9% qualified leads per impression",
        conclusion: "Partially Confirmed — Founder-led wins, but uplift smaller than hypothesis",
        status: "COMPLETED",
        startedAt: new Date("2026-08-15"),
        completedAt: new Date("2026-09-05")
      },
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        campaignId: acmeCampaigns[1].id,
        title: "Landing page: long-form vs short-form",
        hypothesis: "Long-form landing page will reduce bounce and increase qualified leads",
        variable: "landing_page",
        control: JSON.stringify({ length: "short" }),
        treatment: JSON.stringify({ length: "long" }),
        audience: "Google search visitors",
        budget: 40000,
        durationDays: 14,
        kpi: "qualified_lead_rate",
        status: "RUNNING",
        startedAt: new Date("2026-09-10")
      },
      {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        campaignId: finriseCampaigns[0].id,
        title: "Lead magnet: free guide vs calculator",
        hypothesis: "Interactive retirement calculator will outperform a free PDF guide",
        variable: "lead_magnet",
        control: JSON.stringify({ type: "pdf_guide" }),
        treatment: JSON.stringify({ type: "calculator" }),
        audience: "Salaried 32-45",
        budget: 30000,
        durationDays: 14,
        kpi: "lead_conversion",
        expectedResult: "+20%",
        status: "PLANNED"
      }
    ]
  });

  // ── 15. Decision log ─────────────────────────────────────────────────────
  console.log("→ Creating decision log");
  await prisma.decisionLog.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        campaignId: acmeCampaigns[1].id,
        decisionType: "BUDGET_CHANGE",
        decision: "Increased Google search budget by 25%",
        reason: "CPL on Google search 18% below Meta — opportunity to scale",
        hypothesis: "Reallocating budget will maintain or improve blended CPL",
        expectedOutcome: "Blended CPL stays below ₹400",
        actualOutcome: "Blended CPL rose from ₹320 to ₹360 (still profitable)",
        evaluation: "Partial success — tracked, considered worth iterating",
        authorId: mmU.id,
        approvedById: adminU.id,
        executedAt: new Date("2026-09-01"),
        evaluatedAt: new Date("2026-09-08")
      },
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        campaignId: acmeCampaigns[0].id,
        decisionType: "CREATIVE_CHANGE",
        decision: "Paused underperforming carousel creative (CTR < 0.8%)",
        reason: "Creative fatigue — CTR dropped 35% over 14 days",
        hypothesis: "Pausing will reallocate spend to higher-CTR creatives and improve CPL",
        expectedOutcome: "CPL improves 10%",
        actualOutcome: "CPL improved 6%",
        evaluation: "Confirmed",
        authorId: cmU.id,
        approvedById: mmU.id,
        executedAt: new Date("2026-09-12"),
        evaluatedAt: new Date("2026-09-20")
      },
      {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        decisionType: "AUDIENCE_CHANGE",
        decision: "Added Bengaluru-Tier-1 lookalike audience to Meta campaign",
        reason: "Bengaluru leads converted 2x better than average",
        hypothesis: "Lookalike audience will replicate Bengaluru conversion profile",
        expectedOutcome: "+12% qualified lead rate",
        actualOutcome: "+9% qualified lead rate",
        evaluation: "Partial success",
        authorId: mmU.id,
        approvedById: adminU.id,
        executedAt: new Date("2026-09-05"),
        evaluatedAt: new Date("2026-09-22")
      }
    ]
  });

  // ── 16. Reports ──────────────────────────────────────────────────────────
  console.log("→ Creating reports");
  await prisma.report.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        title: "Acme Realty — August 2026 Performance",
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-08-31"),
        executiveSummary:
          "August delivered 412 qualified leads against a target of 350 — +18% above plan. ROAS held at 4.2x. Meta outperformed Google on volume, Google on cost-efficiency. One experiment on creative hooks confirmed founder-led video wins.",
        performance: JSON.stringify({
          spend: 320000,
          leads: 1240,
          qualifiedLeads: 412,
          customers: 18,
          revenue: 4200000,
          roas: 4.2,
          cpl: 776
        }),
        funnel: JSON.stringify({
          impressions: 1840000,
          clicks: 28500,
          leads: 1240,
          qualified: 412,
          meetings: 180,
          proposals: 64,
          wins: 18
        }),
        leadQuality: "Bengaluru leads converting 1.8x average. Webinar-attended leads 2x better.",
        creativePerformance: "Founder-led video drove 50% of leads at 30% of spend.",
        recommendations: "Increase webinar promotion spend by 30% next month. Refresh testimonial creatives — CTR declining.",
        nextActions: "1. Brief content team on new testimonial refresh. 2. Lock Oct webinar calendar. 3. Tier-2 city expansion pilot.",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-02")
      },
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        title: "Acme Realty — September 2026 (Mid-month)",
        periodStart: new Date("2026-09-01"),
        periodEnd: new Date("2026-09-15"),
        executiveSummary: "Mid-month check: spend on pace, leads +12% vs forecast. Webinar cohort the strongest single segment.",
        status: "DRAFT"
      },
      {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        title: "FinRise — Q3 Performance",
        periodStart: new Date("2026-07-01"),
        periodEnd: new Date("2026-09-15"),
        executiveSummary: "ROAS 2.1x — within target. Lead quality improving post-lookalike audience expansion.",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-20")
      }
    ]
  });

  // ── 17. Client requests ──────────────────────────────────────────────────
  console.log("→ Creating client requests");
  await prisma.clientRequest.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        submitterId: acmeClientU.id,
        title: "Increase webinar promotion budget by ₹50K",
        description: "Webinar-attended leads convert 2x better. Want to push October webinars harder.",
        category: "BUDGET",
        priority: "HIGH",
        status: "IN_PROGRESS",
        assigneeId: mmU.id
      },
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        submitterId: acmeClientU.id,
        title: "Refresh testimonial creatives — fatigue setting in",
        description: "Carousel CTR dropped from 2.4% to 0.9% over 14 days.",
        category: "CREATIVE",
        priority: "MEDIUM",
        status: "ACKNOWLEDGED",
        assigneeId: contentU.id
      },
      {
        orgId: adzigaOrg.id,
        clientId: acmeClient.id,
        submitterId: acmeClientU.id,
        title: "Q1 2027 strategy review meeting",
        description: "Want a working session to plan Q1 2027 campaigns.",
        category: "MEETING",
        priority: "MEDIUM",
        status: "RESOLVED",
        assigneeId: adminU.id,
        resolution: "Meeting scheduled for Oct 28, 2026."
      },
      {
        orgId: adzigaOrg.id,
        clientId: finriseClient.id,
        submitterId: finriseClientU.id,
        title: "Add Hyderabad to targeting",
        description: "We see inbound from Hyderabad. Should we test it formally?",
        category: "STRATEGY",
        priority: "LOW",
        status: "SUBMITTED"
      }
    ]
  });

  // ── 18. Tasks ────────────────────────────────────────────────────────────
  console.log("→ Creating internal tasks");
  await prisma.task.createMany({
    data: [
      { orgId: adzigaOrg.id, title: "Brief content team on testimonial refresh", status: "TODO", priority: "HIGH", dueDate: new Date(Date.now() + 3 * 86400_000), creatorId: mmU.id, assigneeId: contentU.id },
      { orgId: adzigaOrg.id, title: "Set up Meta CAPI for new Acme landing page", status: "IN_PROGRESS", priority: "HIGH", dueDate: new Date(Date.now() + 2 * 86400_000), creatorId: mmU.id, assigneeId: cmU.id },
      { orgId: adzigaOrg.id, title: "October webinar — confirm panelists", status: "TODO", priority: "MEDIUM", dueDate: new Date(Date.now() + 5 * 86400_000), creatorId: adminU.id, assigneeId: mmU.id },
      { orgId: adzigaOrg.id, title: "Quarterly finance close", status: "TODO", priority: "URGENT", dueDate: new Date(Date.now() + 10 * 86400_000), creatorId: adminU.id, assigneeId: financeU.id },
      { orgId: adzigaOrg.id, title: "Update Finrise audience geo to include Hyderabad", status: "TODO", priority: "LOW", dueDate: new Date(Date.now() + 7 * 86400_000), creatorId: mmU.id, assigneeId: cmU.id }
    ]
  });

  // ── 19. Notifications ────────────────────────────────────────────────────
  console.log("→ Creating notifications");
  await prisma.notification.createMany({
    data: [
      { orgId: adzigaOrg.id, userId: mmU.id, type: "lead_received", title: "12 new qualified leads today", message: "Acme Realty — 12 leads in QUALIFIED status", link: "/app/leads?status=QUALIFIED" },
      { orgId: adzigaOrg.id, userId: mmU.id, type: "approval_required", title: "Strategy v3 awaiting your approval", message: "Acme Q1 Investor Acquisition — Strategy v3", link: "/app/strategy" },
      { orgId: adzigaOrg.id, userId: cmU.id, type: "campaign_health", title: "Google campaign CPL rising", message: "Acme — Google CPL up 22% vs 7-day avg", link: "/app/campaigns" },
      { orgId: adzigaOrg.id, userId: adminU.id, type: "report_ready", title: "September mid-month report ready", message: "Acme Realty", link: "/app/reports" },
      { orgId: adzigaOrg.id, userId: financeU.id, type: "invoice_due", title: "Invoice INV-2026-018 due in 3 days", message: "Acme Realty — ₹3,12,500", link: "/app/admin/billing" }
    ]
  });

  // ── 20. Automations ──────────────────────────────────────────────────────
  console.log("→ Creating automations");
  await prisma.automation.createMany({
    data: [
      {
        orgId: adzigaOrg.id,
        name: "Auto-assign new leads to sales by source",
        description: "When a lead is created, assign based on its source (Meta → Priya, Google → Priya, Event → Arjun).",
        trigger: "lead.created",
        conditions: JSON.stringify({ status: "NEW" }),
        actions: JSON.stringify([
          { type: "set.assignee", params: { source_to_user: { META_AD: "sales@adziga.in", GOOGLE_AD: "sales@adziga.in", EVENT: "cm@adziga.in" } } },
          { type: "notify.user", params: { template: "lead.assigned" } }
        ]),
        runsCount: 124,
        lastRunAt: new Date(Date.now() - 3600_000)
      },
      {
        orgId: adzigaOrg.id,
        name: "Pause campaigns when daily budget exceeded",
        description: "If a campaign's daily spend exceeds 110% of planned daily budget, pause it and notify the manager.",
        trigger: "campaign.spend_threshold",
        conditions: JSON.stringify({ threshold_pct: 110 }),
        actions: JSON.stringify([
          { type: "campaign.pause" },
          { type: "notify.user", params: { template: "budget.exceeded" } }
        ]),
        runsCount: 7,
        lastRunAt: new Date(Date.now() - 86400_000)
      },
      {
        orgId: adzigaOrg.id,
        name: "Notify client on weekly report publish",
        description: "When a report is published, send the client an in-app + email notification.",
        trigger: "report.published",
        conditions: JSON.stringify({ status: "PUBLISHED" }),
        actions: JSON.stringify([
          { type: "notify.user", params: { template: "report.published" } },
          { type: "email.client", params: { template: "report.ready" } }
        ]),
        runsCount: 4,
        lastRunAt: new Date(Date.now() - 4 * 86400_000)
      }
    ]
  });

  // ── 21. Integrations ─────────────────────────────────────────────────────
  console.log("→ Creating integration health records");
  await prisma.integration.createMany({
    data: [
      { orgId: adzigaOrg.id, provider: "META", status: "HEALTHY", lastSyncAt: new Date(Date.now() - 1800_000) },
      { orgId: adzigaOrg.id, provider: "GOOGLE", status: "HEALTHY", lastSyncAt: new Date(Date.now() - 3600_000) },
      { orgId: adzigaOrg.id, provider: "WHATSAPP", status: "DEGRADED", lastSyncAt: new Date(Date.now() - 7200_000), errorMessage: "Rate limit on bulk sends — backoff in effect" },
      { orgId: adzigaOrg.id, provider: "GEMINI", status: "HEALTHY", lastSyncAt: new Date(Date.now() - 86400_000) }
    ]
  });

  // ── 22. Audit log ────────────────────────────────────────────────────────
  console.log("→ Creating audit log entries");
  await prisma.auditLog.createMany({
    data: [
      { orgId: adzigaOrg.id, userId: mmU.id, action: "campaign.update", entityType: "Campaign", entityId: acmeCampaigns[1].id, after: JSON.stringify({ budget: 220000 }) },
      { orgId: adzigaOrg.id, userId: mmU.id, action: "strategy.approve", entityType: "Strategy", entityId: acmeStrategyV1.id, after: JSON.stringify({ status: "APPROVED" }) },
      { orgId: adzigaOrg.id, userId: cmU.id, action: "creative.update", entityType: "Creative", after: JSON.stringify({ status: "ACTIVE" }) },
      { orgId: adzigaOrg.id, userId: adminU.id, action: "report.publish", entityType: "Report" }
    ]
  });

  // ── 23. Billing ──────────────────────────────────────────────────────────
  console.log("→ Creating billing accounts + invoices");
  await prisma.billingAccount.createMany({
    data: [
      { orgId: acmeOrg.id, plan: "PRO", monthlyFee: 25000, billingEmail: "billing@acme-realty.example.in", billingCycleDay: 1 },
      { orgId: finriseOrg.id, plan: "PRO", monthlyFee: 18000, billingEmail: "billing@finrise.example.in", billingCycleDay: 1 }
    ]
  });
  await prisma.invoice.createMany({
    data: [
      { orgId: acmeOrg.id, number: "INV-2026-018", status: "SENT", amount: 25000, periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30") },
      { orgId: acmeOrg.id, number: "INV-2026-017", status: "PAID", amount: 25000, periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), paidAt: new Date("2026-08-15") },
      { orgId: finriseOrg.id, number: "INV-2026-013", status: "SENT", amount: 18000, periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30") }
    ]
  });

  // ── 24. AI interactions ──────────────────────────────────────────────────
  console.log("→ Creating AI interactions");
  await prisma.aIInteraction.createMany({
    data: [
      { orgId: adzigaOrg.id, userId: mmU.id, mode: "ASSISTANT", prompt: "Why did CPL increase last week?", response: "CPL rose 18% week-over-week. Primary driver: Meta CPM up 22% during festive inventory tightening. CPL on Google Search held steady.", model: "adziga-stub-v1", latencyMs: 240 },
      { orgId: adzigaOrg.id, userId: mmU.id, mode: "ASSISTANT", prompt: "Summarize September performance", response: "September (mid-month): spend on pace, leads +12% vs forecast. Webinar cohort the strongest single segment. ROAS held.", model: "adziga-stub-v1", latencyMs: 310 },
      { orgId: adzigaOrg.id, userId: salesU.id, mode: "ASSISTANT", prompt: "How many qualified leads came from events this month?", response: "From events this month: 80 qualified leads across 1 completed webinar + 1 in-flight briefing.", model: "adziga-stub-v1", latencyMs: 220 }
    ]
  });

  // ── 25. Revenue / AdSpend rows for analytics ─────────────────────────────
  console.log("→ Creating revenue + ad spend");
  const allCustomers = await prisma.customer.findMany();
  for (const c of allCustomers) {
    await prisma.revenue.create({
      data: { orgId: c.orgId, clientId: c.clientId, amount: c.revenue, currency: "INR", source: "Customer conversion", recordedAt: c.acquiredAt }
    });
  }
  for (const camp of allCampaigns) {
    if (camp.spent > 0) {
      await prisma.adSpend.create({
        data: {
          orgId: camp.orgId,
          campaignId: camp.id,
          amount: camp.spent,
          platform: camp.platform,
          currency: "INR"
        }
      });
    }
  }

  console.log("✓ Seed complete");
  console.log("\nTest logins:");
  console.log("  super@adziga.in / adziga123     — Super Admin");
  console.log("  founder@adziga.in / adziga123   — Founder");
  console.log("  admin@adziga.in / adziga123     — Admin");
  console.log("  mm@adziga.in / adziga123        — Marketing Manager");
  console.log("  cm@adziga.in / adziga123        — Campaign Manager");
  console.log("  sales@adziga.in / adziga123     — Sales");
  console.log("  finance@adziga.in / adziga123   — Finance");
  console.log("  content@adziga.in / adziga123   — Content");
  console.log("  client@acme.in / adziga123      — Client Admin (Acme)");
  console.log("  client@finrise.in / adziga123   - Client Admin (FinRise)");

  console.log("\n-> Phase 2: Seeding industry benchmarks");
  const bm = await seedBenchmarks();
  console.log(`  Benchmarks seeded: ${(bm as any).seeded ?? "n/a"}`);

  console.log("-> Phase 3: Recomputing content patterns");
  const cp = await recomputeContentPatterns(adzigaOrg.id);
  console.log(`  Patterns analyzed: ${cp.patternsAnalyzed}, insights: ${cp.insights.length}`);

  console.log("\n✓ Phase 0 + Phase 1 + Phase 2 + Phase 3 seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });