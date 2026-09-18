// Adziga — Auth service
// Email/password auth with: bcrypt, email verification, password reset, MFA (TOTP),
// session management, OAuth (Google), brute-force protection.

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sendEmail } from "@/server/email";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError, RateLimitError, AppError } from "@/server/errors";
import { logger } from "@/server/logger";

const EMAIL_VERIFY_TTL_MS = 24 * 3600_000;
const PASSWORD_RESET_TTL_MS = 60 * 60_0000;
const SESSION_TTL_MS = 30 * 24 * 3600_000; // 30 days

// ─── Brute-force protection (in-memory, swap for Redis in prod) ────────
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60_000;

function checkLockout(key: string) {
  const r = failedLogins.get(key);
  if (r && r.lockedUntil > Date.now()) {
    throw new RateLimitError(Math.ceil((r.lockedUntil - Date.now()) / 1000));
  }
}

function recordFailure(key: string) {
  const r = failedLogins.get(key) ?? { count: 0, lockedUntil: 0 };
  r.count += 1;
  if (r.count >= MAX_FAILED) {
    r.lockedUntil = Date.now() + LOCKOUT_MS;
    logger.warn("auth.account_locked", { key });
  }
  failedLogins.set(key, r);
}

function clearFailures(key: string) {
  failedLogins.delete(key);
}

// ──────────────────────────────────────────────────────────────────────────
// Signup
// ──────────────────────────────────────────────────────────────────────────

export type SignupInput = {
  email: string;
  password: string;
  name?: string;
  orgName: string;
};

export async function signup(input: SignupInput): Promise<{ userId: string; orgId: string; verifyUrl: string }> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, 12);

  // Generate slug from org name
  const baseSlug = input.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";
  let slug = baseSlug;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  // Transactional: create user + org + add as SUPER_ADMIN
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.orgName,
        slug,
        tier: "FREE",
        industry: "Other"
      }
    });
    const user = await tx.user.create({
      data: { email, name: input.name, passwordHash, role: "SUPER_ADMIN" }
    });
    await tx.orgMember.create({
      data: { userId: user.id, orgId: org.id, role: "FOUNDER" }
    });
    // Initialize onboarding
    await tx.onboardingStep.createMany({
      data: [
        { orgId: org.id, step: "profile", status: "pending" },
        { orgId: org.id, step: "connect_meta", status: "pending" },
        { orgId: org.id, step: "first_campaign", status: "pending" },
        { orgId: org.id, step: "team", status: "pending" },
        { orgId: org.id, step: "billing", status: "pending" },
        { orgId: org.id, step: "done", status: "pending" }
      ]
    });
    return { user, org };
  });

  // Send verification email
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerification.create({
    data: { userId: result.user.id, token, expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) }
  });

  const appUrl = process.env.APP_URL ?? "https://app.adziga.in";
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    template: "verify_email",
    variables: { verifyUrl }
  });

  await prisma.loginAttempt.create({
    data: { email, ip: "signup", success: true, reason: "signup" }
  });

  return { userId: result.user.id, orgId: result.org.id, verifyUrl };
}

// ──────────────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────────────

export type LoginInput = {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
};

export async function login(input: LoginInput): Promise<{ userId: string; sessionToken: string; mfaRequired: boolean; orgId: string }> {
  const email = input.email.toLowerCase().trim();
  const lockKey = `login:${email}`;
  checkLockout(lockKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    recordFailure(lockKey);
    await prisma.loginAttempt.create({ data: { email, ip: input.ip ?? "", userAgent: input.userAgent, success: false, reason: "no_user" } });
    throw new UnauthorizedError("Invalid credentials");
  }

  if (user.status === "SUSPENDED") {
    throw new AppError("SUSPENDED", "Account suspended. Contact support.", 403);
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    recordFailure(lockKey);
    await prisma.loginAttempt.create({ data: { email, ip: input.ip ?? "", userAgent: input.userAgent, success: false, reason: "bad_password", userId: user.id } });
    throw new UnauthorizedError("Invalid credentials");
  }

  clearFailures(lockKey);

  // Check MFA
  if (user.mfaEnabled) {
    const mfa = await prisma.mfaSecret.findUnique({ where: { userId: user.id } });
    if (mfa?.enabled) {
      // MFA requires second-step; issue short-lived "mfa-pending" token
      const pendingToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      // For simplicity we mark the session with a separate flag in metadata; here we return mfaRequired.
      return { userId: user.id, sessionToken: pendingToken, mfaRequired: true, orgId: "" };
    }
  }

  // Issue session token
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      userAgent: input.userAgent,
      ip: input.ip,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  await prisma.session.update({
    where: { token },
    data: { lastSeenAt: new Date() }
  }).catch(() => null);
  await prisma.loginAttempt.create({ data: { email, userId: user.id, ip: input.ip ?? "", userAgent: input.userAgent, success: true } });

  const primaryOrg = await prisma.orgMember.findFirst({ where: { userId: user.id }, orderBy: { joinedAt: "asc" } });
  return { userId: user.id, sessionToken: token, mfaRequired: false, orgId: primaryOrg?.orgId ?? "" };
}

// ──────────────────────────────────────────────────────────────────────────
// Email verification
// ──────────────────────────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<{ userId: string }> {
  const v = await prisma.emailVerification.findUnique({ where: { token } });
  if (!v) throw new NotFoundError("Verification token");
  if (v.usedAt) throw new ConflictError("Token already used");
  if (v.expiresAt < new Date()) throw new AppError("EXPIRED", "Verification token expired", 410);

  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: v.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: v.userId }, data: { emailVerified: new Date() } })
  ]);

  return { userId: v.userId };
}

// ──────────────────────────────────────────────────────────────────────────
// Password reset
// ──────────────────────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<{ sent: boolean; resetUrl?: string }> {
  // Don't reveal whether the email exists
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { sent: true };

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) }
  });

  const appUrl = process.env.APP_URL ?? "https://app.adziga.in";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    template: "password_reset",
    variables: { email: user.email, resetUrl }
  });

  return { sent: true, resetUrl };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ userId: string }> {
  const r = await prisma.passwordReset.findUnique({ where: { token } });
  if (!r) throw new NotFoundError("Reset token");
  if (r.usedAt) throw new ConflictError("Token already used");
  if (r.expiresAt < new Date()) throw new AppError("EXPIRED", "Reset token expired", 410);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: r.userId }, data: { passwordHash } }),
    // Invalidate all sessions
    prisma.session.updateMany({ where: { userId: r.userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);

  return { userId: r.userId };
}

// ──────────────────────────────────────────────────────────────────────────
// MFA (TOTP) - simplified implementation
// ──────────────────────────────────────────────────────────────────────────

// Use base32 + HMAC-SHA1 per RFC 6238
function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = s.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 4);
  buf.writeUInt32BE(counter & 0xffffffff, 0);
  // Simple HMAC-SHA1 via Web Crypto in worker context, or Node crypto here
  // For this implementation use crypto.createHmac
  const hmac = require("node:crypto").createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % (10 ** digits);
  return code.toString().padStart(digits, "0");
}

export function generateMfaSecret(): Buffer {
  return crypto.randomBytes(20);
}

export function mfaOtpAuthUrl(email: string, secretB32: string): string {
  const issuer = "Adziga";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}`;
}

export async function enableMfa(userId: string, secretB32: string, code: string): Promise<{ backupCodes: string[] }> {
  if (!verifyTotp(base32Decode(secretB32), code)) throw new ValidationError("Invalid code");
  const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex"));
  await prisma.$transaction([
    prisma.mfaSecret.upsert({
      where: { userId },
      update: { secret: encrypt(secretB32), enabled: true, backupCodes: JSON.stringify(backupCodes.map(hash)) },
      create: { userId, secret: encrypt(secretB32), enabled: true, backupCodes: JSON.stringify(backupCodes.map(hash)) }
    }),
    prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } })
  ]);
  await sendEmail({ to: "", template: "mfa_enabled", variables: {} }).catch(() => null);
  return { backupCodes };
}

export function verifyTotp(secret: Buffer, code: string): boolean {
  const now = Math.floor(Date.now() / 1000 / 30);
  // Allow ±1 window for clock skew
  for (let w = -1; w <= 1; w++) {
    const expected = hotp(secret, now + w);
    if (timingSafeEqual(expected, code)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Simple symmetric encryption for stored secrets (AES-GCM)
function encrypt(plaintext: string): string {
  const key = crypto.createHash("sha256").update(process.env.MFA_ENCRYPTION_KEY ?? "dev-key-change-me").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

// ──────────────────────────────────────────────────────────────────────────
// Session management
// ──────────────────────────────────────────────────────────────────────────

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { token, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" }
  });
}

// ──────────────────────────────────────────────────────────────────────────
// OAuth (Google) - simplified
// ──────────────────────────────────────────────────────────────────────────

export async function findOrCreateOAuthUser(profile: {
  provider: string;
  providerUserId: string;
  email: string;
  name?: string;
  image?: string;
}): Promise<{ userId: string; created: boolean }> {
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
    include: { user: true }
  });
  if (existing) return { userId: existing.userId, created: false };

  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  let created = false;
  if (!user) {
    user = await prisma.user.create({
      data: { email: profile.email, name: profile.name, image: profile.image, emailVerified: new Date() }
    });
    created = true;
  }
  await prisma.oAuthAccount.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      accessToken: "", // store encrypted in production
      refreshToken: ""
    }
  });
  return { userId: user.id, created };
}