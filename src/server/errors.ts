// Adziga — Centralized error handling
// All server actions, API routes, and services throw typed errors.
// The middleware maps them to consistent HTTP responses.

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", `${entity}${id ? ` (${id})` : ""} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super("VALIDATION", message, 422, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super("RATE_LIMIT", "Too many requests", 429, { retryAfter });
  }
}

export class IntegrationError extends AppError {
  constructor(provider: string, message: string, statusCode = 502) {
    super("INTEGRATION", `${provider}: ${message}`, statusCode);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}