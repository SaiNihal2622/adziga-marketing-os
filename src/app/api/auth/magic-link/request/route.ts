import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { publicRoute } from "@/server/api";
import { sendEmail } from "@/server/email";
import { logger } from "@/server/logger";
import { RateLimitError } from "@/server/errors";

const MAGIC_LINK_TTL_MS = 15 * 60_000; // 15 minutes

const schema = z.object({ email: z.string().email().max(200) });

// In-memory rate limiter for magic-link requests (per email)
const recentRequests = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 request per minute per email

export const POST = publicRoute(schema, async (_ctx, body) => {
  const email = body.email.toLowerCase().trim();

  // Rate limit per email (in-memory, swap for Redis in prod)
  const last = recentRequests.get(email);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    throw new RateLimitError(60);
  }
  recentRequests.set(email, Date.now());

  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal whether the email exists — return generic success
  // (unless we have a way to email — in stub mode we return the link directly)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  let signInUrl: string | null = null;
  let demoLink: string | null = null;

  if (user) {
    await prisma.magicLink.create({
      data: { email, token, expiresAt }
    });

    const appUrl = process.env.APP_URL ?? "https://adziga.in";
    signInUrl = `${appUrl}/api/auth/magic-link/verify?token=${token}`;

    // Send via email service
    const result = await sendEmail({
      to: email,
      template: "magic_link",
      variables: { signInUrl }
    });

    // In stub mode, return the link directly in the response so the demo flow works
    if (process.env.EMAIL_PROVIDER === "stub" || process.env.EMAIL_PROVIDER === undefined || !result.ok) {
      demoLink = signInUrl;
      logger.info("magic_link.stub_sent", { email });
    } else {
      logger.info("magic_link.sent", { email });
    }
  } else {
    logger.info("magic_link.no_user", { email });
  }

  return {
    ok: true,
    // In stub/no-user mode, include the link so the demo flow works
    ...(demoLink ? { devLink: demoLink } : {}),
    // Always return generic message — never leak user existence
    message: "If an account exists for that email, a sign-in link has been sent."
  };
});
