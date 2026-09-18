import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, audit } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { StatusPill } from "../_components/widgets";
import { fmtDate, fmtNum } from "@/lib/format";
import { STRATEGY_STATUS_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createStrategy(formData: FormData) {
  "use server";
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "") || undefined;
  if (!title) return;
  const s = await prisma.strategy.create({
    data: {
      orgId: session.orgId,
      clientId: clientId || undefined,
      title,
      version: 1,
      status: "DRAFT",
      authorId: session.userId
    }
  });
  await audit(session.orgId, session.userId, "strategy.create", {
    entityType: "Strategy",
    entityId: s.id,
    after: { title, version: 1 }
  });
  redirect(`/app/strategy/${s.id}`);
}

export default async function StrategyPage() {
  const session = await requireSession();
  const strategies = await prisma.strategy.findMany({
    where: { orgId: session.orgId },
    include: { client: true, author: true, approver: true },
    orderBy: { updatedAt: "desc" }
  });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId }, orderBy: { businessName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy"
        subtitle="Human-controlled in Phase 0. Every change creates a version with author, reason, and approval status - the foundation for future intelligence."
      />

      {/* New strategy form */}
      <form action={createStrategy} className="card p-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <label className="label">Strategy title</label>
          <input name="title" required className="input" placeholder="Acme - Q1 2027 Lead Acquisition" />
        </div>
        <div className="w-64">
          <label className="label">Client (optional)</label>
          <select name="clientId" className="input">
            <option value="">- Internal / general -</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </div>
        <button className="btn btn-primary">+ New strategy</button>
      </form>

      {/* Strategy table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Client</th>
              <th>Version</th>
              <th>Status</th>
              <th>Author</th>
              <th>Approver</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/app/strategy/${s.id}`} className="font-medium text-brand-600 hover:underline">{s.title}</Link></td>
                <td>{s.client?.businessName ?? <span className="text-ink-400">-</span>}</td>
                <td>v{s.version}</td>
                <td><StatusPill status={s.status} /></td>
                <td className="text-xs">{s.author.name}</td>
                <td className="text-xs">{s.approver?.name ?? <span className="text-ink-400">-</span>}</td>
                <td className="text-xs">{fmtDate(s.updatedAt)}</td>
                <td><Link href={`/app/strategy/${s.id}`} className="text-xs text-brand-600 hover:underline">Open </Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Version chain visualization */}
      {strategies.some((s) => s.parentId) && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Version history</h3>
          <p className="text-xs text-ink-500 mb-4">Every change to a strategy creates a new version with author and change reason. This becomes training data for future intelligence.</p>
          <ul className="space-y-2">
            {strategies.filter((s) => s.parentId).map((s) => {
              const parent = strategies.find((p) => p.id === s.parentId);
              return (
                <li key={s.id} className="text-sm flex items-center gap-2">
                  <Link href={`/app/strategy/${parent?.id}`} className="text-brand-600 hover:underline">{parent?.title} v{parent?.version}</Link>
                  <span></span>
                  <Link href={`/app/strategy/${s.id}`} className="font-medium text-brand-600 hover:underline">{s.title} v{s.version}</Link>
                  <span className="text-xs text-ink-500 ml-2">- {s.changeReason ?? "no reason recorded"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}