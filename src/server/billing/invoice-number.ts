// Adziga — GST-compliant invoice numbering
// India GST rules:
//   - Sequential, contiguous per financial year (Apr-Mar)
//   - Format: PREFIX/YYYY-YY/NNNNNN (e.g. INV/2026-27/000001)
//   - Never reuse a number, even across financial years (reset counter on FY change)
//   - Same FY uses same prefix; new FY rolls counter

const FY_START_MONTH = 3; // April (0-indexed: 3)

export function getCurrentFinancialYear(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  // FY = "YYYY-YY" where YYYY is start year. Apr 2026 -> "2026-27".
  const startYear = m >= FY_START_MONTH ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(opts: {
  prefix: string;
  financialYear: string;
  counter: number; // 1-based
}): string {
  const padded = String(opts.counter).padStart(6, "0");
  return `${opts.prefix}/${opts.financialYear}/${padded}`;
}

/**
 * Atomically reserve the next invoice number for an org. Rolls the financial
 * year and resets the counter when crossing April 1.
 *
 * Returns the formatted invoice number AND the persisted counter value so
 * callers can store it on the Invoice row.
 */
export async function reserveNextInvoiceNumber(
  prisma: any,
  orgId: string
): Promise<{ number: string; counter: number; financialYear: string; prefix: string }> {
  const currentFY = getCurrentFinancialYear();

  // Single transactional update that resets the counter on FY rollover.
  // Using a transaction to avoid concurrent allocations sharing the same number.
  const result = await prisma.$transaction(async (tx: any) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { invoiceCounter: true, invoicePrefix: true, financialYear: true }
    });
    if (!org) throw new Error("org_not_found");

    const isNewFY = org.financialYear !== currentFY;
    const newCounter = isNewFY ? 1 : (org.invoiceCounter ?? 0) + 1;
    const prefix = org.invoicePrefix ?? "INV";

    await tx.organization.update({
      where: { id: orgId },
      data: {
        invoiceCounter: newCounter,
        financialYear: currentFY,
        invoicePrefix: prefix
      }
    });

    return {
      counter: newCounter,
      financialYear: currentFY,
      prefix
    };
  });

  return {
    number: formatInvoiceNumber({
      prefix: result.prefix,
      financialYear: result.financialYear,
      counter: result.counter
    }),
    counter: result.counter,
    financialYear: result.financialYear,
    prefix: result.prefix
  };
}
