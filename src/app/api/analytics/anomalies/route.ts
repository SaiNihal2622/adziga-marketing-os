import { z } from "zod";
import { authedRoute } from "@/server/api";
import { detectOrgAnomalies } from "@/lib/analytics";

const schema = z.object({
  days: z.number().int().min(14).max(180).optional(),
  threshold: z.number().min(2).max(5).optional()
});

export const POST = authedRoute(schema, async (ctx, body) => {
  const results = await detectOrgAnomalies(ctx.orgId, body.days ?? 30);
  // Flatten to a single list for easier consumption
  const flat = [];
  for (const [metric, r] of Object.entries(results)) {
    for (const a of r.anomalies) {
      flat.push({ ...a, baselineMean: r.baselineMean, baselineStdDev: r.baselineStdDev });
    }
  }
  return {
    metrics: results,
    anomalies: flat.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
  };
});
