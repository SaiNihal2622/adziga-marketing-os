// Adziga — /app/experiments
// Sprint 6 — list view with create form (variant-aware).
// Server actions create via Prisma directly + seedVariants.

import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { Badge, Card, Kpi } from "../_components/ui";
import { fmtDate } from "@/lib/format";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createExperiment(formData: FormData) {
  "use server";
  const session = await requireSession();

  const variantsJson = String(formData.get("variants") ?? "[]");
  let parsedVariants: Array<{ kind: "CONTROL" | "TREATMENT"; label: string; config?: Record<string, unknown>; weight?: number }>;
  try {
    parsedVariants = JSON.parse(variantsJson);
  } catch {
    parsedVariants = [];
  }
  if (parsedVariants.length < 2) {
    throw new Error("Need at least 2 variants (1 control + 1 treatment)");
  }
  if (parsedVariants.filter((v) => v.kind === "CONTROL").length !== 1) {
    throw new Error("Exactly one CONTROL variant is required");
  }

  // Lazy-mint org salt if absent
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { experimentBucketSalt: true }
  });
  if (!org?.experimentBucketSalt) {
    const { randomUUID } = await import("node:crypto");
    await prisma.organization.update({
      where: { id: session.orgId },
      data: { experimentBucketSalt: randomUUID() }
    });
  }

  const exp = await prisma.experiment.create({
    data: {
      orgId: session.orgId,
      clientId: String(formData.get("clientId") ?? "") || null,
      campaignId: String(formData.get("campaignId") ?? "") || null,
      title: String(formData.get("title") ?? "").trim(),
      hypothesis: String(formData.get("hypothesis") ?? "").trim(),
      variable: String(formData.get("variable") ?? "").trim(),
      control: String(formData.get("control") ?? ""),
      treatment: String(formData.get("treatment") ?? ""),
      audience: String(formData.get("audience") ?? "") || null,
      budget: Number(formData.get("budget") ?? 0) || null,
      durationDays: Number(formData.get("durationDays") ?? 14),
      kpi: String(formData.get("kpi") ?? ""),
      metric: String(formData.get("metric") ?? "qualified_rate"),
      minSampleSize: Number(formData.get("minSampleSize") ?? 30),
      expectedResult: String(formData.get("expectedResult") ?? "") || null,
      status: "PLANNED"
    }
  });

  const { ExperimentService } = await import("@/server/services/experiment-service");
  await ExperimentService.seedVariants(prisma, exp.id, parsedVariants);

  await audit(session.orgId, session.userId, "experiment.create", { entityType: "Experiment", entityId: exp.id });
  redirect(`/app/experiments/${exp.id}`);
}

async function transition(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  const data: any = { status: to };
  if (to === "RUNNING") data.startedAt = new Date();
  if (to === "COMPLETED") data.completedAt = new Date();
  await prisma.experiment.update({ where: { id }, data });
  await audit(session.orgId, session.userId, "experiment.status_change", { entityType: "Experiment", entityId: id, after: { status: to } });
}

export default async function ExperimentsPage() {
  const session = await requireSession();
  const experiments = await prisma.experiment.findMany({
    where: { orgId: session.orgId },
    include: {
      client: true,
      campaign: true,
      variants: { orderBy: { id: "asc" } },
      _count: { select: { assignments: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });
  const campaigns = await prisma.campaign.findMany({
    where: { orgId: session.orgId },
    include: { client: true },
    orderBy: { createdAt: "desc" }
  });

  const counts = {
    planned: experiments.filter((e) => e.status === "PLANNED").length,
    running: experiments.filter((e) => e.status === "RUNNING").length,
    completed: experiments.filter((e) => e.status === "COMPLETED").length,
    cancelled: experiments.filter((e) => e.status === "CANCELLED").length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiments"
        subtitle="Hypothesis-driven A/B infrastructure. Each experiment becomes structured training data for the future Strategy Intelligence engine."
        eyebrow="Marketing OS"
      />

      {/* Status KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Planned" value={counts.planned} />
        <Kpi label="Running" value={counts.running} tone="brand" />
        <Kpi label="Completed" value={counts.completed} tone="success" />
        <Kpi label="Cancelled" value={counts.cancelled} tone="accent" />
      </div>

      {/* Create form (client island for variant editor) */}
      <CreateExperimentForm
        clients={clients.map((c) => ({ id: c.id, name: c.businessName }))}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, clientName: c.client.businessName }))}
        action={createExperiment}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {experiments.map((e) => {
          const totalAssigned = e.variants.reduce((s, v) => s + v.assignedCount, 0);
          const totalConverted = e.variants.reduce((s, v) => s + v.convertedCount, 0);
          const totalRevenue = e.variants.reduce((s, v) => s + v.revenueTotal, 0);
          const topVariant = [...e.variants].sort((a, b) => b.convertedCount - a.convertedCount)[0];

          return (
            <Link key={e.id} href={`/app/experiments/${e.id}`} className="block">
              <Card hover>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-ink-500">
                      {e.client?.businessName ?? "Internal"} · {e.campaign?.name ?? "—"} · {e.kpi}
                    </div>
                    <div className="font-semibold mt-1">{e.title}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                    {e.winnerVariantId && <Badge variant="success">Winner</Badge>}
                  </div>
                </div>
                <p className="text-sm text-ink-700 mt-2 italic">"{e.hypothesis}"</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.variants.map((v) => {
                    const isWinner = e.winnerVariantId === v.id;
                    const isControl = v.kind === "CONTROL";
                    return (
                      <div
                        key={v.id}
                        className={`text-[11px] px-2 py-0.5 rounded-md ${
                          isWinner
                            ? "bg-emerald-100 text-emerald-800"
                            : isControl
                            ? "bg-ink-100 text-ink-700"
                            : "bg-brand-50 text-brand-700"
                        }`}
                      >
                        {v.label}: <span className="font-mono">{v.assignedCount}/{v.convertedCount}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-ink-100 text-xs">
                  <div>
                    <div className="text-ink-500">Assigned</div>
                    <div className="font-semibold text-ink-900">{totalAssigned.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <div className="text-ink-500">Converted</div>
                    <div className="font-semibold text-ink-900">{totalConverted.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <div className="text-ink-500">Revenue</div>
                    <div className="font-semibold text-ink-900">₹{totalRevenue.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {experiments.length === 0 && (
        <Card>
          <p className="text-sm text-ink-500 text-center py-12">
            No experiments yet. Plan your first A/B test above to start bucketing incoming leads by variant.
          </p>
        </Card>
      )}
    </div>
  );
}

function statusVariant(s: string): "neutral" | "brand" | "success" | "accent" {
  if (s === "RUNNING") return "brand";
  if (s === "COMPLETED") return "success";
  if (s === "CANCELLED") return "accent";
  return "neutral";
}

// Client island for the variant editor
import { ExperimentCreateForm } from "./_create-form";

function CreateExperimentForm(props: {
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; clientName: string }>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return <ExperimentCreateForm {...props} />;
}
