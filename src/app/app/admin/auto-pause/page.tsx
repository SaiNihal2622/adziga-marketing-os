// Adziga — /app/admin/auto-pause
// Sprint 17b — dedicated page for the auto-pause policy. Default =
// conservative (disabled + dryRun). Admin can toggle enabled/dryRun,
// tune consecutive-streak threshold, add whitelists, and trigger an
// evaluation that shows the candidate list (real or what-if).

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { PageHeader } from "../../_components/page-header";
import { Card, Kpi, SectionHeader, Badge } from "../../_components/ui";
import { AutoPausePolicyEditor } from "./_editor";
import { AutoPauseRunButton } from "./_run-button";
import { AutoPausePolicyService } from "@/server/services/auto-pause-policy";

export const dynamic = "force-dynamic";

export default async function AutoPausePage() {
  const sessionInfo = await requireRole([Role.FOUNDER, Role.ADMIN]);

  // Load policy + last-run preview (run-as-dryRun so we always show
  // candidates, but never mutate when admin is just reading).
  const [policy, preview, clients] = await Promise.all([
    AutoPausePolicyService.getPolicy(sessionInfo.orgId),
    AutoPausePolicyService.evaluate(sessionInfo.orgId),
    prisma.client.findMany({
      where: { orgId: sessionInfo.orgId },
      select: { id: true, businessName: true },
      orderBy: { businessName: "asc" }
    })
  ]);

  const previewCandidates = preview.candidates;
  const willPause = preview.candidates.filter((c) => !c.skipped).slice(0, policy.maxPerRun);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-pause policy"
        subtitle="When the anomaly detector flags a campaign as 'pause' for several days running, this policy decides whether to flip its status to PAUSED or just leave an Approval ticket. Defaults are conservative (disabled + dryRun)."
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Auto-pause" }]}
        right={
          <div className="flex items-center gap-2">
            <Badge variant={policy.enabled && !policy.dryRun ? "success" : policy.dryRun ? "warning" : "neutral"}>
              {policy.enabled
                ? policy.dryRun
                  ? "Enabled · dry-run"
                  : "Enabled · live"
                : "Disabled"}
            </Badge>
            <Link
              href="/app/admin/auto-approve"
              className="px-2 py-1 rounded text-xs bg-ink-100 text-ink-700 hover:bg-ink-200"
            >
              Auto-approve policies →
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Last evaluation" value={fmtDateTime(preview.evaluatedAt)} hint={`${preview.total.evaluated} candidates`} />
        <Kpi label="Would pause" value={String(willPause.length)} hint={`cap ${policy.maxPerRun}/run`} tone={willPause.length > 0 ? "accent" : "neutral"} />
        <Kpi label="Skipped (whitelist)" value={String(preview.total.skipped)} tone={preview.total.skipped > 0 ? "neutral" : undefined} />
        <Kpi label="Streak threshold" value={`${policy.consecutiveAnomalyDays} consecutive runs`} hint="min days of pause-recommendation" />
      </div>

      <SectionHeader title="Policy" description="Tweak these toggles, then click Save. Run evaluation will respect the saved policy." />
      <Card padding="lg">
        <AutoPausePolicyEditor
          initial={policy}
          clients={clients.map((c) => ({ id: c.id, name: c.businessName }))}
        />
      </Card>

      <SectionHeader
        title="Last evaluation"
        description={preview.dryRun ? "(dry-run — no campaigns were modified)" : "(live — matching campaigns have been paused)"}
        actions={<AutoPauseRunButton />}
      />

      {previewCandidates.length === 0 ? (
        <Card>
          <div className="px-5 py-10 text-center">
            <div className="text-emerald-600 font-semibold mb-1">No campaigns flagged</div>
            <p className="text-sm text-ink-500">Nothing in the anomaly detector currently rises to the streak threshold. Come back when something flags.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-ink-50/40">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Streak</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {previewCandidates.map((c) => {
                  const would = !c.skipped && preview.candidates.filter((x) => !x.skipped).indexOf(c) < policy.maxPerRun;
                  const actionLabel = c.paused
                    ? "PAUSED"
                    : c.skipped
                      ? "SKIPPED"
                      : would
                        ? "WILL PAUSE"
                        : "OVER CAP";
                  const actionVariant = c.paused
                    ? "danger"
                    : c.skipped
                      ? "neutral"
                      : would
                        ? "warning"
                        : "neutral";
                  return (
                    <tr key={c.campaignId} className="border-t border-ink-100">
                      <td className="px-4 py-3">
                        <Link href={`/app/campaigns/${c.campaignId}`} className="font-medium text-ink-900 hover:underline">
                          {c.campaignName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs"><Badge variant="neutral">{c.platform}</Badge></td>
                      <td className="px-4 py-3 text-xs">
                        {c.clientId ? (
                          <Link href={`/app/clients/${c.clientId}`} className="text-ink-700 hover:underline">
                            {c.clientName ?? "—"}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-mono">
                        {c.observations}/3 runs
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-700 max-w-md">
                        <div className="truncate" title={c.reason}>{c.reason}</div>
                        {c.skipReason && (
                          <div className="text-[10px] text-ink-500 mt-0.5">{c.skipReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <Badge variant={actionVariant}>{actionLabel}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function fmtDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}
