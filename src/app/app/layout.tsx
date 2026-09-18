import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { navRoutesForRole } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { SidebarNav } from "./_components/sidebar-nav";
import { TopBar } from "./_components/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login?callbackUrl=/app");
  }

  const nav = navRoutesForRole(session.role);

  // Counts for badges
  const [openRequests, pendingTasks, unreadNotifs] = await Promise.all([
    prisma.clientRequest.count({ where: { orgId: session.orgId, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { orgId: session.orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.notification.count({ where: { userId: session.userId, read: false } })
  ]);

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <SidebarNav
        operator={nav.operator}
        client={nav.client}
        role={session.role}
        orgName={session.orgName}
        tier={session.orgTier}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userName={session.userName}
          userEmail={session.userEmail}
          role={session.role}
          orgName={session.orgName}
          tier={session.orgTier}
          notifCount={unreadNotifs}
          requestsCount={openRequests}
          tasksCount={pendingTasks}
        />
        <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto fade-in">
          {children}
        </main>
        <footer className="border-t border-ink-200 px-6 py-4 text-xs text-ink-500 flex items-center justify-between">
          <div>
            Adziga - AI-first Marketing OS - {new Date().getFullYear()}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app/audit" className="hover:text-brand-600">Audit</Link>
            <Link href="/app/admin/integrations" className="hover:text-brand-600">Integrations</Link>
            <span className="badge badge-neutral">Phase 0 - Human-led</span>
          </div>
        </footer>
      </div>
    </div>
  );
}