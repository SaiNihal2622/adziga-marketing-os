// Adziga — API route helper
// Wraps route handlers with: validation, error mapping, audit, rate limiting hooks.

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { requireSession, audit, TierRequiredError } from "@/lib/session";
import { AppError, isAppError, UnauthorizedError } from "./errors";
import { logger } from "./logger";
import type { OrgTier, Role } from "@/lib/constants";

export type ApiContext = {
  userId: string;
  orgId: string;
  orgTier: OrgTier;
  role: Role;
  req: NextRequest;
};

export type AuthedHandler<P = unknown, R = unknown> = (
  ctx: ApiContext,
  data: P,
  params: Record<string, string>
) => Promise<R>;

export function authedRoute<P, R = unknown>(
  schema: ZodSchema<P> | null,
  handler: AuthedHandler<P, R>,
  opts?: { audit?: { action: string; entityType?: string } }
) {
  return async (
    req: NextRequest,
    routeParams?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const start = Date.now();
    let session: Awaited<ReturnType<typeof requireSession>>;
    try {
      session = await requireSession();
    } catch (e) {
      return errorResponse(e instanceof Error ? new UnauthorizedError(e.message) : e);
    }

    const ctx: ApiContext = {
      userId: (session as any).userId,
      orgId: (session as any).orgId,
      orgTier: (session as any).orgTier,
      role: (session as any).role,
      req
    };

    try {
      let data: any = undefined;
      if (schema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          const body = await req.json();
          data = schema.parse(body);
        } catch (e) {
          if (e instanceof ZodError) {
            throw new (class extends AppError {
              constructor() {
                super("VALIDATION", "Invalid input", 422, { issues: (e as ZodError).issues });
              }
            })();
          }
          throw e;
        }
      } else if (req.method === "GET") {
        const url = new URL(req.url);
        data = Object.fromEntries(url.searchParams.entries());
      }

      const result = await handler(ctx, data as P, routeParams?.params ?? {});

      if (opts?.audit) {
        await audit(ctx.orgId, ctx.userId, opts.audit.action, {
          entityType: opts.audit.entityType,
          entityId: typeof result === "object" && result !== null && "id" in result ? (result as any).id : undefined,
          after: typeof result === "object" ? result : undefined
        });
      }

      logger.info("api", {
        method: req.method,
        path: req.nextUrl.pathname,
        userId: ctx.userId,
        orgId: ctx.orgId,
        status: 200,
        durationMs: Date.now() - start
      });
      return NextResponse.json(result);
    } catch (e) {
      logger.error("api_error", {
        method: req.method,
        path: req.nextUrl.pathname,
        userId: ctx.userId,
        orgId: ctx.orgId,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        durationMs: Date.now() - start
      });
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): NextResponse {
  if (isAppError(e)) {
    return NextResponse.json(
      { error: e.code, message: e.message, details: e.details },
      { status: e.statusCode }
    );
  }
  if (e instanceof TierRequiredError) {
    return NextResponse.json(
      {
        error: "TIER_REQUIRED",
        message: `Upgrade to ${e.required} required (current: ${e.current})`,
        details: { required: e.required, current: e.current, upgradeUrl: "/app/admin/billing" }
      },
      { status: 402 }
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION", message: "Invalid input", details: { issues: e.issues } },
      { status: 422 }
    );
  }
  const message = e instanceof Error ? e.message : "Internal error";
  return NextResponse.json({ error: "INTERNAL", message }, { status: 500 });
}

// Public routes (no auth required)
export function publicRoute<P, R = unknown>(
  schema: ZodSchema<P> | null,
  handler: (ctx: { req: NextRequest }, data: P) => Promise<R>
) {
  return async (
    req: NextRequest,
    routeParams?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const start = Date.now();
    try {
      let data: any = undefined;
      if (schema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        const body = await req.json();
        data = schema.parse(body);
      } else if (req.method === "GET") {
        const url = new URL(req.url);
        data = Object.fromEntries(url.searchParams.entries());
      }
      const result = await handler({ req }, data as P);
      logger.info("public_api", {
        method: req.method,
        path: req.nextUrl.pathname,
        status: 200,
        durationMs: Date.now() - start
      });
      return NextResponse.json(result);
    } catch (e) {
      return errorResponse(e);
    }
  };
}