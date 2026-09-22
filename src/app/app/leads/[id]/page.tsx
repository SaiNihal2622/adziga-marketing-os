// Adziga — /app/leads/[id]
// Lead detail with attribution context (source campaign, touchpoint journey,
// linked customer) and a "Mark as Won" action that promotes the lead to
// a Customer row atomically (writes acquiredCampaignId, stamps convertedAt,
// appends a final LeadTouch row, audits the event).

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Card, Kpi, SectionHeader, StatRow } from "@/app/app/_components/ui";
import { fmtINR, fmtDate, fmtRelative } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_LIFECYCLE_ORDER } from "@/lib/constants";
import { AttributionService } from "@/server/services/attribution-service";

export const dynamic = "force-dynamic";

async function updateLead(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const revenue = Number(formData.get("revenue") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "") || null;
  const acquiredCampaignId = String(formData.get("acquiredCampaignId") ?? "") || null;

  const l = await prisma.lead.findFirst({ where: { id, orgId: session.orgId } });
  if (!l) return;

  if (status === "WON") {
    // Atomic: lead.status=WON, customer row created/updated, LeadTouch appended.
    await AttributionService.promoteLeadToCustomer({
      orgId: session.orgId,
      userId: session.userId,
      leadId: id,
      revenue,
      notes: notes ?? undefined,
      acquiredCampaignId: acquiredCampaignId ?? undefined
    });
  } else {
    await prisma.lead.update({
      where: { id },
      data: {
        status,
        score: Number(formData.get("score") ?? 0),
        qualificationData: String(formData.get("qualificationData") ?? "") || null,
        lastContactAt: ["CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL"].includes(status) ? new Date() : l.lastContactAt,
        lostAt: status === "LOST" ? new Date() : l.lostAt,
        wonAt: status === "WON" ? new Date() : l.wonAt,
        convertedAt: status === "WON" ? new Date() : l.convertedAt
      }
    });
    await audit(session.orgId, session.userId, "lead.update", {
      entityType: "Lead",
      entityId: id,
      after: { status }
    });
  }
  redirect(`/app/leads/${id}`);
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const l = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      client: true,
      campaign: true,
      influencer: true,
      event: true,
      customer: { include: { acquiredCampaign: true } },
      touches: {
        orderBy: { touchedAt: "asc" },
        include: { campaign: { select: { id: true, name: true, platform: true } } }
      }
    }
  });
  if (!l) notFound();

  const followUps = l.followUps ? JSON.parse(l.followUps) : [];
  const timeToConvert = l.convertedAt && l.createdAt
    ? Math.round((new Date(l.convertedAt).getTime() - new Date(l.createdAt).getTime()) / 86_400_000)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow={`Lead · ${l.source}`}
        title={l.name ?? l.email ?? `Lead ${l.id.slice(0, 6)}`}
        subtitle={`${l.city ?? "—"} · score ${l.score} · ${fmtRelative(l.createdAt)}`}
        breadcrumbs={[{ label: "Leads", href: "/app/leads" }, { label: l.name ?? l.email ?? l.id }]}
        right={
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={l.status} />
            {l.customer && <Badge variant="success" dot>Converted</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-8">
        {/* Edit form */}
        <Card padding="lg">
          <SectionHeader title="Update status" description="Marking as WON promotes the lead to a Customer row atomically and writes attribution." />
          <form action={updateLead} className="space-y-4">
            <input type="hidden" name="id" value={l.id} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status</label>
                <select name="status" defaultValue={l.status} className="input">
                  {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Score (0-100)</label>
                <input type="number" name="score" defaultValue={l.score} min={0} max={100} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Qualification data</label>
              <textarea
                name="qualificationData"
                defaultValue={l.qualificationData ?? ""}
                rows={3}
                className="input"
                placeholder='{"budget": "2Cr+", "timeline": "0-3 months", "decision_maker": true}'
              />
            </div>

            {l.status === "WON" || true ? (
              <details className="rounded-lg border border-ink-200/70 bg-ink-50/40 p-3" open={l.status === "WON"}>
                <summary className="text-sm font-medium text-ink-900 cursor-pointer select-none">
                  Conversion details (only used when status = WON)
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label">Revenue (₹)</label>
                    <input
                      type="number"
                      name="revenue"
                      defaultValue={l.revenue || l.customer?.revenue || 0}
                      min={0}
                      className="input"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label">Conversion campaign</label>
                    <select
                      name="acquiredCampaignId"
                      defaultValue={l.customer?.acquiredCampaignId ?? l.campaignId ?? ""}
                      className="input"
                    >
                      <option value="">(default — lead's source campaign)</option>
                      {l.campaign && (
                        <option value={l.campaign.id}>
                          {l.campaign.name} · {l.campaign.platform}
                        </option>
                      )}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Conversion notes</label>
                    <textarea
                      name="notes"
                      defaultValue={l.customer?.notes ?? ""}
                      rows={2}
                      className="input"
                      placeholder="Deal context, terms, follow-up commitments..."
                    />
                  </div>
                </div>
              </details>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <button type="submit" className="btn btn-primary">Save & apply</button>
            </div>
          </form>
        </Card>

        {/* Side panel: contact + attribution */}
        <div className="space-y-4">
          <Card padding="lg">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 mb-3">Contact</h3>
            <StatRow label="Email" value={l.email ?? "—"} />
            <StatRow label="Phone" value={l.phone ?? "—"} />
            <StatRow label="City" value={l.city ?? "—"} />
            <StatRow label="Source" value={<Badge variant="neutral">{l.source}</Badge>} />
          </Card>

          <Card padding="lg">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 mb-3">Attribution</h3>
            <StatRow
              label="Source campaign"
              value={l.campaign ? (
                <Link href={`/app/campaigns/${l.campaign.id}`} className="text-brand-600 hover:underline text-sm">
                  {l.campaign.name}
                </Link>
              ) : "—"}
              hint={l.campaign ? l.campaign.platform : undefined}
            />
            <StatRow
              label="Influencer"
              value={l.influencer ? (
                <Link href={`/app/influencers/${l.influencer.id}`} className="text-brand-600 hover:underline text-sm">
                  {l.influencer.name}
                </Link>
              ) : "—"}
            />
            <StatRow
              label="Event"
              value={l.event ? (
                <Link href={`/app/events/${l.event.id}`} className="text-brand-600 hover:underline text-sm">
                  {l.event.name}
                </Link>
              ) : "—"}
            />
            <StatRow label="Landing page" value={<code className="text-xs">{l.landingPage ?? "—"}</code>} />
            <StatRow label="Click ID" value={<code className="text-xs">{l.clickId ?? "—"}</code>} />
            <StatRow label="UTM Source/Medium" value={<code className="text-xs">{l.utmSource ?? "—"} / {l.utmMedium ?? "—"}</code>} />
            {l.customer && (
              <StatRow
                label="Linked customer"
                value={
                  <Link href={`/app/clients/${l.clientId}`} className="text-brand-600 hover:underline text-sm">
                    {l.customer.name} → ₹{Number(l.customer.revenue).toLocaleString("en-IN")}
                  </Link>
                }
                hint={l.customer.acquiredCampaign?.name}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Lifecycle progress */}
      <SectionHeader title="Lifecycle" />
      <Card padding="lg" className="mb-8">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {LEAD_LIFECYCLE_ORDER.map((s, i) => {
            const reachedIdx = LEAD_LIFECYCLE_ORDER.indexOf(l.status as any);
            const isLost = l.status === "LOST";
            const reached = isLost ? false : reachedIdx >= i;
            const current = l.status === s;
            return (
              <div
                key={s}
                className={`p-3 rounded-lg text-center border ${
                  current ? "bg-brand-600 text-white border-brand-700"
                    : reached ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-white text-ink-500 border-ink-200"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">Step {i + 1}</div>
                <div className="font-medium text-xs mt-1">{LEAD_STATUS_LABELS[s]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Multi-touch attribution journey */}
      <SectionHeader
        title="Attribution journey"
        description="Every campaign/creative that touched this lead, in chronological order."
      />
      <Card padding="none" className="mb-8">
        {l.touches.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-500">
            No touches recorded yet. They'll appear here as campaigns fire pixel events.
          </div>
        ) : (
          <ol className="relative">
            {l.touches.map((t, i) => {
              const isFirst = i === 0;
              const isLast = i === l.touches.length - 1;
              const isConversion = t.touchType === "QUALIFICATION" && t.metadata && JSON.parse(t.metadata).kind === "conversion";
              return (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3 border-b border-ink-100 last:border-b-0">
                  <div className="relative">
                    <div className={`size-2.5 rounded-full mt-1.5 ${isConversion ? "bg-emerald-500" : "bg-brand-500"}`} />
                    {!isLast && <div className="absolute left-1/2 top-4 bottom-0 -translate-x-1/2 w-px bg-ink-200 -mb-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">{t.touchType}</span>
                      {isFirst && <Badge variant="brand">First-touch</Badge>}
                      {isLast && !isConversion && <Badge variant="neutral">Last-touch</Badge>}
                      {isConversion && <Badge variant="success">Conversion</Badge>}
                    </div>
                    <div className="text-sm font-medium text-ink-900 mt-0.5">
                      {t.campaign ? (
                        <Link href={`/app/campaigns/${t.campaign.id}`} className="hover:text-brand-600 transition-colors">
                          {t.campaign.name}
                        </Link>
                      ) : "—"}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {fmtDate(t.touchedAt)} · {t.campaign?.platform}
                      {t.metadata && <code className="ml-1 text-[10px] text-ink-400">{t.metadata.slice(0, 60)}</code>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="Revenue" value={fmtINR(l.revenue || l.customer?.revenue || 0)} tone="brand" />
        <Kpi label="Last contact" value={l.lastContactAt ? fmtRelative(l.lastContactAt) : "—"} />
        <Kpi
          label="Time to convert"
          value={timeToConvert !== null ? `${timeToConvert}d` : "—"}
          hint={timeToConvert !== null ? "from creation" : "not converted yet"}
        />
        <Kpi label="Touches" value={l.touches.length.toString()} hint="multi-touch attribution" />
      </div>

      <SectionHeader title="Follow-ups" />
      <Card padding="none">
        {followUps.length === 0 ? (
          <div className="px-5 py-8 text-sm text-ink-500 text-center">
            No follow-ups recorded.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {followUps.map((f: any, i: number) => (
              <li key={i} className="px-5 py-3 text-sm">{f.note ?? JSON.stringify(f)}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    NEW: { variant: "neutral", label: "New" },
    CONTACTED: { variant: "info", label: "Contacted" },
    QUALIFIED: { variant: "brand", label: "Qualified" },
    MEETING_SCHEDULED: { variant: "brand", label: "Meeting" },
    PROPOSAL: { variant: "accent", label: "Proposal" },
    WON: { variant: "success", label: "Won" },
    LOST: { variant: "danger", label: "Lost" }
  };
  const m = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
