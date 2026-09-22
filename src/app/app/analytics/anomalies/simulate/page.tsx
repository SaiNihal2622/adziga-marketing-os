// Adziga — /app/analytics/anomalies/simulate
// Server wrapper that fetches the 30-day baseline then renders the client simulator.

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../../_components/page-header";
import { AnomalySimulator } from "./_simulator";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
  const session = await requireSession();
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [leadCount, customerAgg, spendAgg] = await Promise.all([
    prisma.lead.count({ where: { orgId: session.orgId, createdAt: { gte: since } } }),
    prisma.customer.aggregate({
      where: { orgId: session.orgId, acquiredAt: { gte: since } },
      _sum: { revenue: true },
      _count: { _all: true }
    }),
    prisma.campaign.aggregate({
      where: { orgId: session.orgId },
      _sum: { spent: true }
    })
  ]);

  const baseline = {
    totalLeads: leadCount,
    totalCustomers: customerAgg._count._all ?? 0,
    totalRevenue: customerAgg._sum.revenue ?? 0,
    totalSpend: spendAgg._sum.spent ?? 0
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="What-if anomaly simulator"
        subtitle="Stress-test your CAC, ROAS, and net ROI against CPL spikes, lead drops, and budget changes. Pure client-side math against your last 30 days."
        eyebrow="Marketing OS"
        breadcrumbs={[
          { label: "Analytics", href: "/app/analytics" },
          { label: "Anomalies", href: "/app/analytics/anomalies" },
          { label: "Simulate" }
        ]}
      />
      <AnomalySimulator baseline={baseline} />
    </div>
  );
}
