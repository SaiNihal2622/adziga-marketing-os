// Service-layer integration tests
// NOTE: Service tests are excluded from default vitest run because they require Next.js server context.
// Run explicitly: npx vitest run --include 'tests/services/**/*.test.ts'
// For now, we cover pure logic in intelligence/strategy-engine.test.ts

import { describe, it, expect } from "vitest";

describe("service layer (smoke)", () => {
  it("should import services", async () => {
    const svc = await import("@/server/services/lead-service");
    expect(svc.LeadService).toBeDefined();
    expect(svc.LeadService.list).toBeDefined();
    expect(svc.LeadService.scoreAndAssign).toBeDefined();
  });

  it("should import errors", async () => {
    const errs = await import("@/server/errors");
    expect(errs.AppError).toBeDefined();
    expect(errs.NotFoundError).toBeDefined();
    expect(errs.ConflictError).toBeDefined();
    expect(errs.ValidationError).toBeDefined();
  });

  it("should import services barrel", async () => {
    const cs = await import("@/server/services/client-service");
    expect(cs.ClientService.list).toBeDefined();
    expect(cs.ClientService.create).toBeDefined();
  });

  it("should import all service modules without errors", async () => {
    await import("@/server/services/campaign-service");
    await import("@/server/services/strategy-service");
    await import("@/server/services/creative-service");
    await import("@/server/services/task-service");
    expect(true).toBe(true);
  });
});