import { describe, it, expect } from "vitest";
import { getCurrentFinancialYear, formatInvoiceNumber } from "@/server/billing/invoice-number";

describe("GST-compliant invoice numbering", () => {
  it("April onwards uses same year as FY start", () => {
    expect(getCurrentFinancialYear(new Date("2026-04-15"))).toBe("2026-27");
    expect(getCurrentFinancialYear(new Date("2026-12-31"))).toBe("2026-27");
  });

  it("January-March uses previous year as FY start", () => {
    expect(getCurrentFinancialYear(new Date("2026-01-15"))).toBe("2025-26");
    expect(getCurrentFinancialYear(new Date("2026-03-31"))).toBe("2025-26");
  });

  it("April 1 boundary is exclusive start of new FY", () => {
    expect(getCurrentFinancialYear(new Date("2026-04-01"))).toBe("2026-27");
    expect(getCurrentFinancialYear(new Date("2026-03-31"))).toBe("2025-26");
  });

  it("formatInvoiceNumber produces the canonical India format", () => {
    expect(formatInvoiceNumber({ prefix: "INV", financialYear: "2026-27", counter: 1 })).toBe("INV/2026-27/000001");
    expect(formatInvoiceNumber({ prefix: "INV", financialYear: "2026-27", counter: 999999 })).toBe("INV/2026-27/999999");
  });

  it("pads counter to 6 digits", () => {
    expect(formatInvoiceNumber({ prefix: "INV", financialYear: "2026-27", counter: 42 })).toBe("INV/2026-27/000042");
    expect(formatInvoiceNumber({ prefix: "ZIGA", financialYear: "2025-26", counter: 7 })).toBe("ZIGA/2025-26/000007");
  });
});
