// Adziga — Attribution Service
// Closes the loop between Lead → Qualified → Customer → Revenue.
//
// Why this exists: every prior layer (Strategy, Ad Ops, Content) optimises for
// cheap leads. The Marketing OS optimises for *valuable customers*. That shift
// requires three primitives:
//
//   1. promoteLeadToCustomer() — atomically mark a lead as WON and create
//      (or update) the linked Customer row, with acquiredCampaignId set.
//   2. recordTouch()           — append a multi-touch attribution record so
//      we can reason about first-touch, last-touch, and time-decay credit.
//   3. funnel() / valueAdjustedCpl() — compute per-campaign quality
//      rollups: qualified-lead-rate, customer-rate, value-adjusted CPL
//      (CPL divided by customer conversion rate, which makes expensive
//      campaigns with high LTV obvious winners).
//
// Sprint 1 (Sept 2026): foundation for the Marketing OS vision.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { NotFoundError, ValidationError } from "@/server/errors";

export const AttributionService = {
  /**
   * Atomically promote a Lead to WON and create/update the linked Customer
   * row. Backfills acquiredCampaignId from the lead (last-touch attribution).
   *
   * Safe to call on a lead that already has a customer row — it will update
   * the revenue + acquiredAt + campaign instead of creating a duplicate.
   *
   * Returns the (created or updated) Customer record.
   */
  async promoteLeadToCustomer(input: {
    orgId: string;
    userId: string;
    leadId: string;
    revenue: number;
    notes?: string;
    acquiredCampaignId?: string | null;
  }) {
    if (input.revenue < 0) throw new ValidationError("revenue cannot be negative");

    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: input.orgId } });
    if (!lead) throw new NotFoundError("Lead", input.leadId);

    // The conversion campaign defaults to the lead's primary campaign.
    const conversionCampaignId = input.acquiredCampaignId ?? lead.campaignId ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark the lead WON (and stamp convertedAt)
      const updatedLead = await tx.lead.update({
        where: { id: input.leadId },
        data: {
          status: "WON",
          wonAt: lead.wonAt ?? new Date(),
          convertedAt: lead.convertedAt ?? new Date(),
          revenue: input.revenue,
          outcome: lead.outcome ?? "Converted to customer"
        }
      });

      // 2. Upsert the customer. leadId is @unique so this is a one-to-one.
      const existing = await tx.customer.findUnique({ where: { leadId: input.leadId } });
      const customer = existing
        ? await tx.customer.update({
            where: { leadId: input.leadId },
            data: {
              revenue: input.revenue,
              acquiredAt: existing.acquiredAt,
              acquiredCampaignId: conversionCampaignId,
              notes: input.notes ?? existing.notes
            }
          })
        : await tx.customer.create({
            data: {
              orgId: input.orgId,
              clientId: lead.clientId,
              leadId: input.leadId,
              acquiredCampaignId: conversionCampaignId,
              name: lead.name ?? lead.email ?? `Lead ${lead.id.slice(0, 6)}`,
              email: lead.email ?? null,
              phone: lead.phone ?? null,
              revenue: input.revenue,
              notes: input.notes ?? null
            }
          });

      // 3. Append a final-touch attribution record so the journey is preserved.
      if (conversionCampaignId) {
        await tx.leadTouch.create({
          data: {
            orgId: input.orgId,
            leadId: input.leadId,
            campaignId: conversionCampaignId,
            touchType: "QUALIFICATION",
            touchedAt: new Date(),
            metadata: JSON.stringify({ kind: "conversion", revenue: input.revenue })
          }
        });
      }

      return { lead: updatedLead, customer };
    });

    await audit(input.orgId, input.userId, "lead.promoted_to_customer", {
      entityType: "Lead",
      entityId: input.leadId,
      after: { revenue: input.revenue, customerId: result.customer.id, acquiredCampaignId: conversionCampaignId }
    });

    return result;
  },

  /**
   * Record a touch event for multi-touch attribution. Idempotent on the
   * (leadId, campaignId, touchType) tuple within a 1-second window so we
   * don't double-count pixel fires.
   */
  async recordTouch(input: {
    orgId: string;
    leadId: string;
    campaignId?: string | null;
    creativeId?: string | null;
    touchType: "IMPRESSION" | "CLICK" | "VISIT" | "FORM_SUBMIT" | "QUALIFICATION" | "RETARGET";
    metadata?: Record<string, unknown>;
  }) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: input.orgId } });
    if (!lead) throw new NotFoundError("Lead", input.leadId);

    // 1s idempotency window
    const recent = await prisma.leadTouch.findFirst({
      where: {
        leadId: input.leadId,
        campaignId: input.campaignId ?? null,
        touchType: input.touchType,
        touchedAt: { gte: new Date(Date.now() - 1_000) }
      }
    });
    if (recent) return recent;

    return prisma.leadTouch.create({
      data: {
        orgId: input.orgId,
        leadId: input.leadId,
        campaignId: input.campaignId ?? null,
        creativeId: input.creativeId ?? null,
        touchType: input.touchType,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null
      }
    });
  },

  /**
   * Per-campaign funnel: impressions → clicks → leads → qualified → customers
   * → revenue. Numbers are derived from existing tables; nothing new is
   * written.
   *
   * Returns 0 for any stage where the data is missing (so callers can render
   * honest partial funnels).
   */
  async campaignFunnel(orgId: string, campaignId: string) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, orgId },
      select: { id: true, name: true, platform: true, status: true, spent: true, budget: true }
    });
    if (!c) throw new NotFoundError("Campaign", campaignId);

    const [
      leadCount,
      qualifiedCount,
      wonCount,
      customersAgg,
      touchCount
    ] = await Promise.all([
      prisma.lead.count({ where: { campaignId } }),
      prisma.lead.count({ where: { campaignId, status: { in: ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"] } } }),
      prisma.lead.count({ where: { campaignId, status: "WON" } }),
      prisma.customer.aggregate({
        where: { acquiredCampaignId: campaignId },
        _sum: { revenue: true },
        _count: { _all: true }
      }),
      prisma.leadTouch.count({ where: { campaignId } })
    ]);

    const revenue = customersAgg._sum.revenue ?? 0;
    const customerCount = customersAgg._count._all ?? 0;

    // BigInt fields on Campaign are safe to Number() because we know they're
    // bounded — these are ad-platform metrics, not token counts.
    const impressions = Number((await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { impressions: true, clicks: true }
    }))?.impressions ?? 0);
    const clicks = Number((await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { clicks: true }
    }))?.clicks ?? 0);

    const cpl = leadCount > 0 ? c.spent / leadCount : 0;
    const cac = customerCount > 0 ? c.spent / customerCount : 0;
    const qualifiedRate = leadCount > 0 ? qualifiedCount / leadCount : 0;
    const customerRate = leadCount > 0 ? customerCount / leadCount : 0;
    const roas = c.spent > 0 ? revenue / c.spent : 0;
    // Value-adjusted CPL: how much qualified-lead-rate devalues cheap leads.
    // Effective CPL = raw CPL / qualifiedRate, so a campaign with 5% qualified
    // rate effectively pays 20× the raw CPL per qualified lead.
    const effectiveCpl = qualifiedRate > 0 ? cpl / qualifiedRate : cpl;
    // Value-adjusted CAC: CAC / customerRate (the true per-customer cost when
    // most leads don't convert).
    const effectiveCac = customerRate > 0 ? cpl / customerRate : cpl;

    return {
      campaign: c,
      funnel: {
        impressions,
        clicks,
        leads: leadCount,
        qualified: qualifiedCount,
        customers: customerCount,
        revenue
      },
      touchpoints: touchCount,
      rates: {
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpl,
        cac,
        qualifiedRate,
        customerRate,
        roas,
        effectiveCpl,
        effectiveCac
      }
    };
  },

  /**
   * Org-wide funnel snapshot for the Command Center. Aggregates across every
   * campaign in the org. Optional date range lets the UI show "last 30 days"
   * vs "last 90 days".
   */
  async orgFunnel(orgId: string, opts?: { since?: Date; until?: Date }) {
    const leadWhere: any = { orgId };
    const customerWhere: any = { orgId };
    if (opts?.since) {
      leadWhere.createdAt = { ...(leadWhere.createdAt ?? {}), gte: opts.since };
      customerWhere.acquiredAt = { gte: opts.since };
    }
    if (opts?.until) {
      leadWhere.createdAt = { ...(leadWhere.createdAt ?? {}), lte: opts.until };
      customerWhere.acquiredAt = { ...(customerWhere.acquiredAt ?? {}), lte: opts.until };
    }

    const [leadCount, qualifiedCount, wonCount, customersAgg, spendAgg, activeCampaigns] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"] } } }),
      prisma.lead.count({ where: { ...leadWhere, status: "WON" } }),
      prisma.customer.aggregate({ where: customerWhere, _sum: { revenue: true }, _count: { _all: true } }),
      prisma.campaign.aggregate({ where: { orgId }, _sum: { spent: true } }),
      prisma.campaign.count({ where: { orgId, status: "ACTIVE" } })
    ]);

    const revenue = customersAgg._sum.revenue ?? 0;
    const customerCount = customersAgg._count._all ?? 0;
    const totalSpend = spendAgg._sum.spent ?? 0;

    return {
      window: {
        since: opts?.since?.toISOString() ?? null,
        until: opts?.until?.toISOString() ?? null
      },
      funnel: {
        leads: leadCount,
        qualified: qualifiedCount,
        customers: customerCount,
        revenue
      },
      activeCampaigns,
      spend: totalSpend,
      rates: {
        qualifiedRate: leadCount > 0 ? qualifiedCount / leadCount : 0,
        customerRate: leadCount > 0 ? customerCount / leadCount : 0,
        cac: customerCount > 0 ? totalSpend / customerCount : 0,
        roas: totalSpend > 0 ? revenue / totalSpend : 0,
        avgDealSize: customerCount > 0 ? revenue / customerCount : 0
      }
    };
  },

  /**
   * Value-adjusted CPL for every campaign in the org, sorted descending by
   * quality-adjusted cost. This is the headline query that makes expensive
   * campaigns with high LTV obvious winners.
   */
  async valueAdjustedCpl(orgId: string, opts?: { since?: Date; clientId?: string }) {
    const where: any = { orgId };
    if (opts?.clientId) where.clientId = opts.clientId;

    const campaigns = await prisma.campaign.findMany({
      where,
      select: { id: true, name: true, platform: true, status: true, spent: true, client: { select: { businessName: true } } }
    });

    const leadAggs = await prisma.lead.groupBy({
      by: ["campaignId"],
      where: { orgId, campaignId: { not: null } },
      _count: { _all: true }
    });
    const qualifiedAggs = await prisma.lead.groupBy({
      by: ["campaignId"],
      where: {
        orgId,
        campaignId: { not: null },
        status: { in: ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "WON"] }
      },
      _count: { _all: true }
    });
    const customerAggs = await prisma.customer.groupBy({
      by: ["acquiredCampaignId"],
      where: { orgId, acquiredCampaignId: { not: null } },
      _sum: { revenue: true },
      _count: { _all: true }
    });

    const leadsByCampaign = new Map<string, number>();
    for (const row of leadAggs) if (row.campaignId) leadsByCampaign.set(row.campaignId, row._count._all);
    const qualByCampaign = new Map<string, number>();
    for (const row of qualifiedAggs) if (row.campaignId) qualByCampaign.set(row.campaignId, row._count._all);
    const custByCampaign = new Map<string, { customers: number; revenue: number }>();
    for (const row of customerAggs) {
      if (row.acquiredCampaignId) {
        custByCampaign.set(row.acquiredCampaignId, {
          customers: row._count._all,
          revenue: row._sum.revenue ?? 0
        });
      }
    }

    return campaigns
      .map((c) => {
        const leads = leadsByCampaign.get(c.id) ?? 0;
        const qualified = qualByCampaign.get(c.id) ?? 0;
        const cust = custByCampaign.get(c.id) ?? { customers: 0, revenue: 0 };
        const cpl = leads > 0 ? c.spent / leads : 0;
        const qualifiedRate = leads > 0 ? qualified / leads : 0;
        const customerRate = leads > 0 ? cust.customers / leads : 0;
        const cac = cust.customers > 0 ? c.spent / cust.customers : 0;
        const roas = c.spent > 0 ? cust.revenue / c.spent : 0;
        const effectiveCpl = qualifiedRate > 0 ? cpl / qualifiedRate : cpl;
        return {
          campaignId: c.id,
          name: c.name,
          platform: c.platform,
          client: c.client.businessName,
          status: c.status,
          spent: c.spent,
          leads,
          qualified,
          customers: cust.customers,
          revenue: cust.revenue,
          cpl,
          qualifiedRate,
          customerRate,
          cac,
          roas,
          effectiveCpl
        };
      })
      .sort((a, b) => (b.effectiveCpl ?? 0) - (a.effectiveCpl ?? 0));
  },

  /**
   * Value-based budget allocator — the Marketing OS optimizer.
   *
   * Replaces naive Thompson-sampling allocation. Each channel earns budget
   * proportional to its **expected value per rupee**, defined as:
   *
   *     valuePerRupee = (avgDealSize × customerRate × qualifiedRate) / cpl
   *
   * Channels with more data get a credibility multiplier that ramps from
   * 0.5 at 10 leads to 1.0 at 100+ leads (avoids wasting budget on
   * low-volume-but-lucky channels).
   *
   * Then we apply soft floor/cap rules:
   *   - floor 5%  — don't abandon a channel entirely
   *   - cap 50%   — don't put all eggs in one basket
   *   - reserve 10% — leave room for exploration / new channels
   *
   * Returns the recommended split plus the reasoning per channel.
   */
  async valueBasedAllocate(orgId: string, opts?: {
    clientId?: string;
    totalBudget?: number;
    since?: Date;
  }) {
    const since = opts?.since ?? new Date(Date.now() - 60 * 86_400_000);
    const leaderboard = await this.valueAdjustedCpl(orgId, { clientId: opts?.clientId });

    // Pull avg deal size across the org (one global anchor for value)
    const dealAgg = await prisma.customer.aggregate({
      where: {
        orgId,
        ...(opts?.clientId ? { clientId: opts.clientId } : {}),
        acquiredAt: { gte: since }
      },
      _sum: { revenue: true },
      _count: { _all: true }
    });
    const totalRevenue = dealAgg._sum.revenue ?? 0;
    const totalCustomers = dealAgg._count._all ?? 0;
    const avgDealSize = totalCustomers > 0 ? totalRevenue / totalCustomers : 50000;

    // Per-platform grouping (Meta / Google / etc.)
    const byPlatform = new Map<string, typeof leaderboard>();
    for (const c of leaderboard) {
      const list = byPlatform.get(c.platform) ?? [];
      list.push(c);
      byPlatform.set(c.platform, list);
    }

    // Per-platform metrics
    const platformRows = Array.from(byPlatform.entries()).map(([platform, camps]) => {
      const leads = camps.reduce((s, c) => s + c.leads, 0);
      const qualified = camps.reduce((s, c) => s + c.qualified, 0);
      const customers = camps.reduce((s, c) => s + c.customers, 0);
      const revenue = camps.reduce((s, c) => s + c.revenue, 0);
      const spend = camps.reduce((s, c) => s + c.spent, 0);
      const cpl = leads > 0 ? spend / leads : 0;
      const qualifiedRate = leads > 0 ? qualified / leads : 0;
      const customerRate = leads > 0 ? customers / leads : 0;
      // Value per rupee: revenue already attached / spend already attached
      // If we have direct revenue -> ROAS. Else use predicted value:
      //   predictedValuePerRupee = avgDealSize × customerRate × qualifiedRate / cpl
      const predictedValuePerRupee = cpl > 0 && customerRate > 0
        ? (avgDealSize * customerRate * qualifiedRate) / cpl
        : 0;
      const roas = spend > 0 ? revenue / spend : 0;
      // Use observed ROAS if available (more reliable); otherwise predicted
      const valuePerRupee = revenue > 0 ? roas : predictedValuePerRupee;
      // Credibility — channels with little data get a discount
      const credibility = Math.min(1, Math.max(0.4, leads / 100));
      return {
        platform,
        campaigns: camps.length,
        leads,
        qualified,
        customers,
        spend,
        revenue,
        cpl,
        qualifiedRate,
        customerRate,
        avgDealSize,
        roas,
        valuePerRupee,
        predictedValuePerRupee,
        credibility,
        valueScore: valuePerRupee * credibility
      };
    });

    // Softmax-style allocation: take valueScores and normalise
    const positiveScores = platformRows.filter((r) => r.valueScore > 0);
    const totalScore = positiveScores.reduce((s, r) => s + r.valueScore, 0);

    const RESERVE = 0.10;
    const FLOOR = 0.05;
    const CAP = 0.50;
    const distributable = 1 - RESERVE;

    // Step 1: raw allocation from value scores
    const withRaw: any[] = platformRows.map((r) => ({
      ...r,
      rawAllocation: totalScore > 0 ? r.valueScore / totalScore : 0
    }));

    // Step 2: apply floor
    const withFloor: any[] = withRaw.map((r) => ({
      ...r,
      flooredAllocation: r.valueScore > 0 ? Math.max(FLOOR, r.rawAllocation * distributable) : 0
    }));

    // Step 3: renormalise after floors
    const flooredSum = withFloor.reduce((s, r) => s + r.flooredAllocation, 0);
    const withFinal: any[] = withFloor.map((r) => ({
      ...r,
      finalAllocation: flooredSum > 0 ? (r.flooredAllocation / flooredSum) * distributable : 0
    }));

    // Step 4: apply cap
    const withCap: any[] = withFinal.map((r) => ({
      ...r,
      cappedAllocation: Math.min(CAP, r.finalAllocation)
    }));

    // Step 5: final renormalisation
    const cappedSum = withCap.reduce((s, r) => s + r.cappedAllocation, 0);
    const allocations: any[] = withCap.map((r) => ({
      ...r,
      allocation: cappedSum > 0 ? (r.cappedAllocation / cappedSum) * distributable : 0
    }));

    // Map to budget amounts
    const totalBudget = opts?.totalBudget ?? 0;
    const withBudget = allocations.map((r: any) => ({
      platform: r.platform,
      allocation: r.allocation,
      budgetInr: totalBudget > 0 ? Math.round(r.allocation * totalBudget) : 0,
      campaigns: r.campaigns,
      leads: r.leads,
      qualified: r.qualified,
      customers: r.customers,
      spend: r.spend,
      revenue: r.revenue,
      cpl: r.cpl,
      qualifiedRate: r.qualifiedRate,
      customerRate: r.customerRate,
      avgDealSize: r.avgDealSize,
      roas: r.roas,
      valuePerRupee: r.valuePerRupee,
      credibility: r.credibility,
      reason: explainAllocation(r)
    }));

    // Sort by allocation descending
    withBudget.sort((a, b) => b.allocation - a.allocation);

    // Projection: expected customers at the recommended split
    const expectedCustomersPerRupee = avgDealSize > 0
      ? withBudget.reduce((s, r) => s + r.customerRate * r.cpl * (r.allocation || 0), 0)
      : 0;

    return {
      windowDays: 60,
      avgDealSize,
      totalBudget,
      allocations: withBudget,
      expectedRoas: withBudget.reduce((s, r) => s + r.valuePerRupee * r.allocation, 0),
      reasoning: explainAllocatorDecision(withBudget, avgDealSize)
    };
  }
};

function explainAllocation(r: {
  platform: string;
  leads: number;
  customerRate: number;
  qualifiedRate: number;
  cpl: number;
  roas: number;
  revenue: number;
  spend: number;
  credibility: number;
  valuePerRupee: number;
}): string {
  if (r.leads === 0) return `No leads yet — explorer allocation at the floor (5%).`;
  if (r.revenue === 0 && r.spend === 0) return `Newly created channel — tracking starts now.`;
  if (r.valuePerRupee >= 3) return `Excellent value (${r.valuePerRupee.toFixed(2)}× per rupee) — high confidence at credibility ${(r.credibility * 100).toFixed(0)}%.`;
  if (r.valuePerRupee >= 1.5) return `Strong value (${r.valuePerRupee.toFixed(2)}×) — qualified rate ${(r.qualifiedRate * 100).toFixed(0)}% / customer rate ${(r.customerRate * 100).toFixed(1)}%.`;
  if (r.valuePerRupee >= 0.5) return `Marginal value (${r.valuePerRupee.toFixed(2)}×) — consider creative refresh before scaling.`;
  if (r.valuePerRupee > 0) return `Weak value (${r.valuePerRupee.toFixed(2)}×) — only floor allocation until performance improves.`;
  return `No signal — holding at floor.`;
}

function explainAllocatorDecision(rows: Array<{ platform: string; allocation: number; valuePerRupee: number }>, avgDealSize: number): string {
  if (rows.length === 0) return "No allocation data yet.";
  const top = rows[0];
  const parts: string[] = [];
  parts.push(`Average deal size: ₹${Math.round(avgDealSize).toLocaleString("en-IN")}.`);
  parts.push(`Top channel ${top.platform} gets ${(top.allocation * 100).toFixed(0)}% because of value-per-rupee ${top.valuePerRupee.toFixed(2)}×.`);
  const capped = rows.filter((r) => r.valuePerRupee > 0 && r.allocation >= 0.45);
  if (capped.length > 0) {
    parts.push(`${capped.map((r) => r.platform).join(", ")} capped at 50% to keep portfolio diversified.`);
  }
  parts.push("10% reserved for new-channel exploration.");
  return parts.join(" ");
}
