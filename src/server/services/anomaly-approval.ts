// Adziga — AnomalyApprovalService (Sprint 16a)
// Bridges CampaignAnomalyService into ApprovalService so a "pause" or
// "scale" recommendation automatically surfaces as an Approval record
// the team can review at /app/admin/approvals.
//
// Idempotent on (entityType, entityId, action) — re-running on the same
// campaign on the same day won't duplicate the approval row.

import { prisma } from "@/lib/db";
import { ApprovalService } from "./approval-service";
import { CampaignAnomalyService } from "./campaign-anomaly-service";

export const AnomalyApprovalService = {
  /**
   * Run the anomaly scan, then for every campaign that recommends
   * "pause" or "scale", create (or upsert) an Approval row that the
   * team can act on.
   *
   * Returns the count of new approvals created. Skips approvals that
   * already exist for the same (entityType, entityId, action, day).
   */
  async sync(orgId: string, days: number = 30): Promise<{
    scanned: number;
    pauseCandidates: number;
    scaleCandidates: number;
    created: number;
  }> {
    const anomalies = await CampaignAnomalyService.detectForOrg(orgId, days);
    const pause = anomalies.filter((a) => a.recommendAction === "pause");
    const scale = anomalies.filter((a) => a.recommendAction === "scale");

    let created = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const a of pause) {
      const existing = await prisma.approval.findFirst({
        where: {
          orgId,
          entityType: "Campaign",
          entityId: a.campaignId,
          action: "pause",
          requestedAt: { gte: new Date(today + "T00:00:00Z") }
        }
      });
      if (existing) continue;

      await ApprovalService.request({
        orgId,
        entityType: "Campaign",
        entityId: a.campaignId,
        action: "pause",
        title: `Auto-pause: ${a.campaignName} (${a.platform})`,
        reason: a.reason,
        severity: "important",
        requestedById: "system:anomaly",
        requestedByKind: "agent",
        payload: {
          source: "campaign_anomaly",
          campaignName: a.campaignName,
          platform: a.platform,
          clientName: a.clientName,
          spent: a.spent,
          budget: a.budget,
          industryCplMax: a.industryCplMax,
          exceedsIndustryCeiling: a.exceedsIndustryCeiling,
          metrics: a.metrics,
          generatedAt: new Date().toISOString()
        }
      });
      created++;
    }

    for (const a of scale) {
      const existing = await prisma.approval.findFirst({
        where: {
          orgId,
          entityType: "Campaign",
          entityId: a.campaignId,
          action: "launch",
          requestedAt: { gte: new Date(today + "T00:00:00Z") }
        }
      });
      if (existing) continue;

      await ApprovalService.request({
        orgId,
        entityType: "Campaign",
        entityId: a.campaignId,
        action: "launch",
        title: `Scale candidate: ${a.campaignName} (${a.platform})`,
        reason: a.reason,
        severity: "minor",
        requestedById: "system:anomaly",
        requestedByKind: "agent",
        payload: {
          source: "campaign_anomaly_scale",
          campaignName: a.campaignName,
          platform: a.platform,
          clientName: a.clientName,
          reason: a.reason,
          metrics: a.metrics,
          generatedAt: new Date().toISOString()
        }
      });
      created++;
    }

    return {
      scanned: anomalies.length,
      pauseCandidates: pause.length,
      scaleCandidates: scale.length,
      created
    };
  }
};
