// Adziga — CSV helpers (Sprint 10c)
// Tiny utility to convert an array of plain objects to RFC 4180 CSV.
// Handles quoting/escaping so values containing commas, quotes, or
// newlines stay parseable.

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) {
    return columns ? columns.join(",") + "\r\n" : "";
  }
  const cols = columns ?? Array.from(
    rows.reduce((set, row) => {
      for (const k of Object.keys(row)) set.add(k);
      return set;
    }, new Set<string>())
  );
  const header = cols.map(csvEscape).join(",");
  const body = rows
    .map((row) => cols.map((c) => csvEscape(row[c])).join(","))
    .join("\r\n");
  return header + "\r\n" + body + (body.length ? "\r\n" : "");
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
