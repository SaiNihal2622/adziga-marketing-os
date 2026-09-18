import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/server/logger";
import { signIn } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "/app";
  const baseUrl = req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", baseUrl));
  }

  const link = await prisma.magicLink.findUnique({ where: { token } });

  if (!link) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", baseUrl));
  }
  if (link.usedAt) {
    return NextResponse.redirect(new URL("/login?error=link_already_used", baseUrl));
  }
  if (link.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=link_expired", baseUrl));
  }

  // Mark token as used (atomic — authorize() also re-checks usedAt)
  await prisma.magicLink.updateMany({
    where: { id: link.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  // Look up the user to confirm they exist
  const user = await prisma.user.findUnique({ where: { email: link.email } });
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=user_not_found", baseUrl));
  }

  logger.info("magic_link.verified", { email: link.email });

  // Use NextAuth signIn to create JWT session and redirect
  // The authorize() function in lib/auth.ts validates the magic link token
  // and returns the user. signIn handles the JWT cookie + redirect.
  try {
    await signIn("credentials", {
      email: link.email,
      magicLinkToken: token,
      redirectTo: callbackUrl,
      redirect: true
    });
    // signIn should always throw NEXT_REDIRECT on success; this is unreachable
    return NextResponse.redirect(new URL(callbackUrl, baseUrl));
  } catch (err: any) {
    const digest = err?.digest ?? err?.message ?? "";
    // NextAuth uses NEXT_REDIRECT to signal a server-side redirect; re-throw
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    logger.error("magic_link.signin_failed", { email: link.email, error: err?.message });
    return NextResponse.redirect(new URL("/login?error=signin_failed", baseUrl));
  }
}
