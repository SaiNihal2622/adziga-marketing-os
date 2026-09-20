import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";
import type { Role, OrgTier } from "./constants";
import { TIER_RANK, hasFeature } from "./constants";

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

/**
 * Tier-gated access. Redirects to billing with an upgrade hint if org tier is
 * below the required tier. Use for PRO+ integrations, ZIGA+ intelligence, etc.
 */
export async function requireTier(required: OrgTier): Promise<SessionInfo> {
  const s = await requireSession();
  if (!hasFeature(s.orgTier, required)) {
    redirect(`/app/admin/billing?error=tier_required&required=${required}&current=${s.orgTier}`);
  }
  return s;
}

/**
 * Tier check that throws rather than redirects (for API routes that return JSON).
 */
export class TierRequiredError extends Error {
  statusCode = 402;
  code = "TIER_REQUIRED";
  constructor(public required: OrgTier, public current: OrgTier) {
    super(`Tier ${required} required (current: ${current}).`);
  }
}

export function checkTier(tier: OrgTier, required: OrgTier): void {
  if (TIER_RANK[tier] < TIER_RANK[required]) {
    throw new TierRequiredError(required, tier);
  }
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