// Adziga — actAs(orgId)
// The Adziga team (FOUNDER + ADMIN roles on the Adziga internal org) can
// operate on a client's org as if they were a member of that org. The
// original `actAsSession` cookie holds a short-lived token; the resolver
// returns the effective orgId for the request.
//
// Why this exists: when the saree seller calls Adziga support at 11pm and
// the account manager needs to fix a paused campaign, they shouldn't have
// to log out of Adziga and log in as the saree seller.

import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

const ACT_AS_COOKIE = "adziga_act_as";
const ACT_AS_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export type ActAsContext = {
  userId: string;
  /** Org the user actually belongs to (Adziga internal) */
  realOrgId: string;
  /** Org they're currently operating as (might equal realOrgId) */
  effectiveOrgId: string;
  /** Whether they're wearing an act-as hat */
  isImpersonating: boolean;
};

export async function getActAsContext(realOrgId: string, userId: string): Promise<ActAsContext> {
  const jar = await cookies();
  const actAsOrgId = jar.get(ACT_AS_COOKIE)?.value;
  if (!actAsOrgId || actAsOrgId === realOrgId) {
    return { userId, realOrgId, effectiveOrgId: realOrgId, isImpersonating: false };
  }

  // Validate the cookie is backed by a real, non-expired ActAsSession row
  const session = await prisma.actAsSession.findFirst({
    where: {
      userId,
      orgId: actAsOrgId,
      expiresAt: { gt: new Date() }
    }
  });

  if (!session) {
    // Expired or revoked — clear and return real org
    return { userId, realOrgId, effectiveOrgId: realOrgId, isImpersonating: false };
  }

  return {
    userId,
    realOrgId,
    effectiveOrgId: actAsOrgId,
    isImpersonating: true
  };
}

export async function startActAs(userId: string, realOrgId: string, targetOrgId: string, reason?: string) {
  if (targetOrgId === realOrgId) {
    throw new Error("already operating in your real org");
  }

  // Confirm target org exists and the user is FOUNDER/ADMIN of the Adziga team.
  const member = await prisma.orgMember.findFirst({
    where: { userId, orgId: realOrgId }
  });
  if (!member || (member.role !== "FOUNDER" && member.role !== "ADMIN")) {
    throw new Error("only Adziga FOUNDER/ADMIN can act-as another org");
  }

  const expiresAt = new Date(Date.now() + ACT_AS_TTL_MS);
  const session = await prisma.actAsSession.create({
    data: { userId, orgId: targetOrgId, expiresAt, reason: reason ?? null }
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      orgId: realOrgId,
      userId,
      action: "actAs.start",
      entityType: "Organization",
      entityId: targetOrgId,
      after: JSON.stringify({ reason, expiresAt })
    }
  });

  return session;
}

export async function stopActAs(userId: string, realOrgId: string) {
  await prisma.actAsSession.deleteMany({ where: { userId, NOT: { orgId: realOrgId } } });
  await prisma.auditLog.create({
    data: { orgId: realOrgId, userId, action: "actAs.stop", entityType: "User", entityId: userId }
  });
}

export const ACT_AS_COOKIE_NAME = ACT_AS_COOKIE;
