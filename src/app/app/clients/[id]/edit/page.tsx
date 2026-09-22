// Adziga — /app/clients/[id]/edit
// Edit form. Critical fields (monthlyBudget, tier, creativePreference, status)
// go through the approval workflow on submit — the API responds with
// { mode: 'pending', approval } instead of the updated client. The form
// surfaces this and tells the user where the change is queued.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/app/app/_components/page-header";
import { Badge, Card } from "@/app/app/_components/ui";
import { ClientEditForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: session.orgId }
  });
  if (!client) notFound();

  const pendingApprovals = await prisma.approval.findMany({
    where: { orgId: session.orgId, entityType: "Client", entityId: client.id, status: "pending" },
    orderBy: { requestedAt: "desc" },
    take: 5
  });

  return (
    <div>
      <PageHeader
        eyebrow="Edit"
        title={client.businessName}
        subtitle="Changes to budgets, tier, status, or creative preference are staged as approvals before they take effect."
        breadcrumbs={[
          { label: "Clients", href: "/app/clients" },
          { label: client.businessName, href: `/app/clients/${client.id}` },
          { label: "Edit" }
        ]}
        right={
          <Link href={`/app/clients/${client.id}`} className="text-sm text-ink-500 hover:text-ink-700">
            ← Back to client
          </Link>
        }
      />

      {pendingApprovals.length > 0 && (
        <Card className="mb-6 border-amber-200/70 bg-amber-50/40">
          <div className="flex items-start gap-3">
            <Badge variant="warning" dot>{pendingApprovals.length} pending</Badge>
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Approvals already queued for this client</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-700">
                {pendingApprovals.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium">{a.title}</span>
                    {a.reason && <span className="text-ink-500"> — {a.reason}</span>}
                  </li>
                ))}
              </ul>
              <Link href="/app/admin/approvals" className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-2 inline-block">
                Review in approvals queue →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <Card padding="lg">
        <ClientEditForm client={JSON.parse(JSON.stringify(client))} />
      </Card>
    </div>
  );
}
