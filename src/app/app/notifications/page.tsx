import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "../_components/page-header";
import { fmtDateTime, relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  // mark all read on view
  if (notifications.some((n) => !n.read)) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="In-app, email, and (future) WhatsApp notifications." />
      <div className="card divide-y divide-ink-100">
        {notifications.length === 0 && <div className="p-10 text-center text-ink-500">No notifications yet.</div>}
        {notifications.map((n) => (
          <div key={n.id} className="p-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{n.title}</div>
              <div className="text-sm text-ink-600 mt-0.5">{n.message}</div>
              <div className="text-xs text-ink-500 mt-1">{n.type.replace(/_/g, " ")} - {relTime(n.createdAt)} - {n.channel ?? "in-app"}</div>
            </div>
            {n.link && <a href={n.link} className="btn btn-secondary btn-sm">Open</a>}
          </div>
        ))}
      </div>
    </div>
  );
}