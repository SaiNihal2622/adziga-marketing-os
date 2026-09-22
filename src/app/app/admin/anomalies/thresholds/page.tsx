// Adziga — /app/admin/anomalies/thresholds
// Sprint 13b — admin UI to tune the anomaly-detection knobs per org.

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../../_components/page-header";
import { Card, Kpi } from "../../../_components/ui";
import { AnomalyThresholdEditor } from "./_editor";

export const dynamic = "force-dynamic";

export default async function AnomalyThresholdsPage() {
  await requireRole([Role.FOUNDER, Role.ADMIN]);

  const org = await prisma.organization.findUnique({
    where: { id: (await (await import("@/lib/session")).requireSession()).orgId },
    select: { metadata: true }
  });
  let overrides = { sigmaThreshold: 2.5, industryCeilingMultiplier: 0.8 };
  if (org?.metadata) {
    try {
      const meta = JSON.parse(org.metadata) as Record<string, unknown>;
      if (meta.anomalyOverrides) overrides = { ...overrides, ...(meta.anomalyOverrides as object) };
    } catch {
      /* malformed */
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomaly thresholds"
        subtitle="Tune the Z-score threshold and industry-ceiling multiplier that drive the auto-pause / watch / scale recommendations."
        eyebrow="Marketing OS"
        breadcrumbs={[
          { label: "Admin", href: "/app/admin" },
          { label: "Anomalies", href: "/app/analytics/anomalies" },
          { label: "Thresholds" }
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Sigma threshold" value={`${overrides.sigmaThreshold}σ`} hint="Z-score needed for an anomaly" />
        <Kpi
          label="Industry ceiling"
          value={`${(overrides.industryCeilingMultiplier * 100).toFixed(0)}%`}
          hint="of cplMax — auto-pause trigger"
        />
        <Kpi label="Lower σ → more alerts" value={`${overrides.sigmaThreshold.toFixed(1)}σ`} hint="default 2.5" />
        <Kpi label="Higher % → more lenient" value={`${(overrides.industryCeilingMultiplier * 100).toFixed(0)}%`} hint="default 80%" />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-ink-700 mb-2">Editor</h3>
        <p className="text-xs text-ink-500 mb-4">
          Changes apply on the next anomaly scan (which runs every time someone opens the Anomalies page).
        </p>
        <AnomalyThresholdEditor initial={overrides} />
      </Card>
    </div>
  );
}
