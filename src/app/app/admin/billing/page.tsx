import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../../_components/page-header";
import { StatusPill } from "../../_components/widgets";
import { fmtINR, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await requireSession();
  const [accounts, invoices] = await Promise.all([
    prisma.billingAccount.findMany({
      where: { orgId: { in: (await prisma.user.findUnique({ where: { id: session.userId }, include: { memberships: true } }))?.memberships.map((m) => m.orgId) ?? [session.orgId] } }
    }),
    prisma.invoice.findMany({
      where: { orgId: session.orgId },
      orderBy: { issuedAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        subtitle="Plans, subscriptions, invoices. Ad Spend is tracked separately from Adziga revenue (per spec ??38)."
      />

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">Billing accounts</h3>
        <table className="table">
          <thead><tr><th>Org</th><th>Plan</th><th>Monthly fee</th><th>Usage fee</th><th>Automation fee</th><th>Currency</th><th>Email</th><th>Cycle day</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="text-sm">{a.orgId}</td>
                <td><span className="badge badge-brand">{a.plan}</span></td>
                <td className="font-mono">{fmtINR(a.monthlyFee)}</td>
                <td className="font-mono">{fmtINR(a.usageBasedFee)}</td>
                <td className="font-mono">{fmtINR(a.automationFee)}</td>
                <td>{a.currency}</td>
                <td className="text-xs">{a.billingEmail ?? "-"}</td>
                <td>{a.billingCycleDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-ink-700 p-4">Invoices</h3>
        <table className="table">
          <thead><tr><th>Number</th><th>Status</th><th>Amount</th><th>Period</th><th>Issued</th><th>Paid</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs">{i.number}</td>
                <td><StatusPill status={i.status} /></td>
                <td className="font-mono">{fmtINR(i.amount)}</td>
                <td className="text-xs">{fmtDate(i.periodStart)}  {fmtDate(i.periodEnd)}</td>
                <td className="text-xs">{fmtDate(i.issuedAt)}</td>
                <td className="text-xs">{i.paidAt ? fmtDate(i.paidAt) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}