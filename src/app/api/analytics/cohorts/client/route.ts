// Adziga — /api/analytics/cohorts/client
// Sprint 8a — lead → customer cohort retention matrix

import { authedRoute } from "@/server/api";
import { CohortService } from "@/server/services/cohort-service";

export const GET = authedRoute(null, async (ctx) => {
  const url = new URL(ctx.req.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return { error: "clientId required" } as any;
  const months = Number(url.searchParams.get("months") ?? 6);

  const [leadCohort, customerCohort] = await Promise.all([
    CohortService.leadToCustomerCohort(ctx.orgId, clientId, months),
    CohortService.customerAcquisitionCohort(ctx.orgId, clientId, months)
  ]);
  return { leadCohort, customerCohort };
});
