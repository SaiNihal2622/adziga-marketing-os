import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";
import type { Role, OrgTier } from "./constants";

export type SessionInfo = {
  userId: string;
  userName: string;
  userEmail: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgTier: OrgTier;
  role: Role;
};

export async function getSession(): Promise<SessionInfo | null> {
  const session = await auth();
  if (!session?.user?.id || !session.activeOrgId) return null;

  const m = session.memberships.find((x) => x.orgId === session.activeOrgId);
  if (!m) return null;

  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email,
    userEmail: session.user.email,
    orgId: m.orgId,
    orgName: m.orgName,
    orgSlug: m.orgSlug,
    orgTier: m.tier as OrgTier,
    role: m.role as Role
  };
}

export async function requireSession(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(roles: Role[]): Promise<SessionInfo> {
  const s = await requireSession();
  if (!roles.includes(s.role)) redirect("/app/overview?error=forbidden");
  return s;
}

export async function audit(
  orgId: string,
  userId: string | null,
  action: string,
  opts?: { entityType?: string; entityId?: string; before?: any; after?: any; ip?: string; userAgent?: string }
) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: userId ?? undefined,
        action,
        entityType: opts?.entityType,
        entityId: opts?.entityId,
        before: opts?.before ? JSON.stringify(opts.before) : undefined,
        after: opts?.after ? JSON.stringify(opts.after) : undefined,
        ip: opts?.ip,
        userAgent: opts?.userAgent
      }
    });
  } catch {
    // never block the request on audit failure
  }
}