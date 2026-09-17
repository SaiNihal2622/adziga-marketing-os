import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "./constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    memberships: Array<{ orgId: string; orgName: string; orgSlug: string; tier: string; role: Role }>;
    activeOrgId: string;
  }
}

// (JWT augmentation omitted — relying on loose typing for the JWT callback)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({
          where: { email },
          include: { memberships: { include: { org: true } } }
        });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = await prisma.user.findUnique({
          where: { id: (user as any).id },
          include: { memberships: { include: { org: true } } }
        });
        if (u) {
          (token as any).uid = u.id;
          (token as any).memberships = u.memberships.map((m) => ({
            orgId: m.orgId,
            orgName: m.org.name,
            orgSlug: m.org.slug,
            tier: m.org.tier,
            role: m.role as Role
          }));
          const memberships = (token as any).memberships as Array<{ orgSlug: string; orgId: string }>;
          const internal = memberships.find((m) => m.orgSlug === "adziga");
          (token as any).activeOrgId = internal?.orgId ?? memberships[0]?.orgId ?? "";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = (token as any).uid;
        (session as any).memberships = (token as any).memberships;
        (session as any).activeOrgId = (token as any).activeOrgId;
      }
      return session;
    }
  }
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireOrg() {
  const session = await requireUser();
  if (!session.activeOrgId) throw new Error("NO_ACTIVE_ORG");
  return session;
}