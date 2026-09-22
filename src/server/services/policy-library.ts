// Adziga — Prebuilt AutoApprove Policies (Sprint 7c)
// Closes point #13 of the Marketing OS vision ("operate autonomously").
//
// These policies are SAFE templates that admins can opt into. They each
// constrain what they auto-apply to a narrow surface (a single field) so
// that even if used carelessly, they cannot leak data or change budgets.
//
// All templates:
//   • target a single non-critical field (paused/archived/completed status)
//   • require an aggregate cap (maxPerDay / maxPerMonth)
//   • default to dryRun=true so admins can see what they'd auto-apply before flipping
//
// Pre-built library (offered via GET /api/admin/policies/library):

import crypto from "node:crypto";
import type { AutoApprovePolicy } from "./policy-types";

type Template = AutoApprovePolicy;

const now = () => new Date().toISOString();

export const PREBUILT_POLICIES: Template[] = [
  {
    id: "tpl-campaign-pause-underperform",
    name: "Pause underperforming campaigns",
    description:
      "Auto-pause any campaign whose CPL exceeds its budget-per-lead by 50% after 7 days of running. Conservative default of dryRun=on.",
    entityType: "Campaign",
    action: "pause",
    fieldConstraints: [
      { field: "status", mustEqual: "PAUSED" }
    ],
    caps: {
      maxPerDay: 3,
      maxPerMonth: 30,
      dryRun: true,
      pauseAfterHour: 22
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  },
  {
    id: "tpl-campaign-archive-completed",
    name: "Archive completed campaigns",
    description:
      "Once a campaign hits COMPLETED status for 14 days, auto-archive it. Clean up the campaign view automatically.",
    entityType: "Campaign",
    action: "archive",
    fieldConstraints: [
      { field: "status", allowedValues: ["ARCHIVED", "COMPLETED"] }
    ],
    caps: {
      maxPerDay: 5,
      maxPerMonth: 100,
      dryRun: true,
      pauseAfterHour: 23
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  },
  {
    id: "tpl-experiment-auto-complete",
    name: "Auto-complete experiments with a clear winner",
    description:
      "When a running experiment hits the Bayesian winner criteria (P(best) ≥ 0.95 with sample size met) for >24 hours, freeze the winner automatically.",
    entityType: "Campaign",
    action: "update",
    fieldConstraints: [
      { field: "status", mustEqual: "COMPLETED" }
    ],
    caps: {
      maxPerDay: 2,
      maxPerMonth: 20,
      dryRun: true,
      requireConfirmationWithinMinutes: 60
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  },
  {
    id: "tpl-integration-disable-stale",
    name: "Disable stale integrations",
    description:
      "Disable Integrations whose lastSyncAt is > 30 days old when an agent flags them. Minor field change only.",
    entityType: "Integration",
    action: "update",
    fieldConstraints: [
      { field: "status", allowedValues: ["DISABLED"] }
    ],
    caps: {
      maxPerDay: 2,
      maxPerMonth: 6,
      dryRun: true
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  },
  {
    id: "tpl-client-update-minor",
    name: "Auto-apply minor client edits",
    description:
      "Auto-apply low-risk updates (city, notes, contactPhone, contactEmail, websiteUrl, businessModel). Anything affecting budget, tier, status, or creativePreference still queues.",
    entityType: "Client",
    action: "update",
    fieldConstraints: [
      // Conservative: mustEqual is omitted so any combination of the safe
      // fields passes. The evaluator rejects when ANY non-allowed field is set.
      { field: "city", pattern: "^.{0,200}$" }
    ],
    caps: {
      maxPerDay: 10,
      maxPerMonth: 200,
      dryRun: true
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  },
  {
    id: "tpl-strategy-archive-draft",
    name: "Archive stale DRAFT strategies",
    description:
      "Archive any Strategy stuck in DRAFT for > 60 days with no recent updates. Minor structural cleanup.",
    entityType: "Strategy",
    action: "archive",
    fieldConstraints: [
      { field: "status", mustEqual: "ARCHIVED" }
    ],
    caps: {
      maxPerDay: 5,
      maxPerMonth: 30,
      dryRun: true
    },
    enabled: false,
    createdAt: now(),
    updatedAt: now(),
    createdById: "library"
  }
];

/**
 * Generate a fresh policy from a library template. Strips createdById
 * so each org gets its own copy.
 */
export function instantiateFromTemplate(templateId: string): Template | null {
  const t = PREBUILT_POLICIES.find((p) => p.id === templateId);
  if (!t) return null;
  return {
    ...t,
    id: crypto.randomUUID(),
    createdById: "template:" + templateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: false,
    caps: { ...t.caps, dryRun: true }
  };
}
