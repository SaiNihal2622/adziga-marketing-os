// Adziga — /app/admin/benchmarks
// Sprint 14b — IndustryBenchmark admin view + edit.

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader } from "../../_components/ui";
import { fmtNum } from "@/lib/format";
import { BenchmarkEditor } from "./_editor";

export const dynamic = "force-dynamic";

export default async function BenchmarksPage() {
  await requireRole([Role.FOUNDER, Role.ADMIN]);
  const benchmarks = await prisma.industryBenchmark.findMany({
    orderBy: [{ industry: "asc" }, { channel: "asc" }],
    take: 200
  });

  const distinctIndustries = Array.from(new Set(benchmarks.map((b) => b.industry)));
  const distinctChannels = Array.from(new Set(benchmarks.map((b) => b.channel)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Industry benchmarks"
        subtitle="Per-(industry, objective, channel, region) CPL/CAC/conv-rate baselines that drive predictive models and anomaly thresholds. Edit existing rows or add new ones."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Benchmarks" }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Benchmarks" value={benchmarks.length} />
        <Kpi label="Industries" value={distinctIndustries.length} />
        <Kpi label="Channels" value={distinctChannels.length} />
        <Kpi label="Sample (median)" value={fmtNum(median(benchmarks.map((b) => b.sampleSize)))} hint="median sampleSize across rows" />
      </div>

      <SectionHeader title="Add or update" description="Upsert by (industry, objective, channel, region)" />

      <Card>
        <BenchmarkEditor />
      </Card>

      <SectionHeader title="Existing" description={`${benchmarks.length} rows`} />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2">Industry</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right">CPL min</th>
                <th className="text-right">CPL median</th>
                <th className="text-right">CPL max</th>
                <th className="text-right">CTR median</th>
                <th className="text-right">Conv median</th>
                <th className="text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.id} className="border-b border-ink-100">
                  <td className="px-4 py-2 font-medium">{b.industry}</td>
                  <td className="px-4 py-2">{b.channel}</td>
                  <td className="px-4 py-2">{b.region}</td>
                  <td className="px-4 py-2 text-right font-mono">₹{b.cplMin.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right font-mono">₹{b.cplMedian.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right font-mono">₹{b.cplMax.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right font-mono">{(b.ctrMedian * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono">{(b.convMedian * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono">{b.sampleSize}</td>
                </tr>
              ))}
              {benchmarks.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-ink-500 py-6">
                    No benchmarks yet. Use the editor above to seed rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
