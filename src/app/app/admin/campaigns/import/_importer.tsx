"use client";

// Adziga — CampaignCsvImporter (Sprint 12a)
// Client island for bulk campaign CSV import. Pastes CSV → dry-run preview → submit.

import { useState } from "react";
import { useRouter } from "next/navigation";

type ParseResult = {
  header: string[];
  rows: string[][];
  error: string | null;
};

export function CampaignCsvImporter() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const handlePaste = (s: string) => {
    setCsv(s);
    setResult(null);
    setParsed(parseCsv(s));
  };

  const submit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/campaigns/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csv
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `failed: ${res.status}`);
      }
      const j = await res.json();
      setResult(j);
      if (j.accepted > 0) {
        setTimeout(() => router.push("/app/campaigns"), 1500);
      }
    } catch (e) {
      setResult({ error: String((e as Error).message ?? e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        className="textarea font-mono text-xs w-full min-h-[260px]"
        placeholder="Paste CSV here. First row = header."
        value={csv}
        onChange={(e) => handlePaste(e.target.value)}
      />

      {parsed && (
        <div className="text-xs text-ink-600 bg-ink-50 rounded p-2">
          <strong>Parsed:</strong> {parsed.rows.length} data row(s), header has {parsed.header.length} column(s).
          {parsed.error && <div className="text-rose-700 mt-1">⚠ {parsed.error}</div>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!csv.trim() || submitting}
          className="btn btn-primary"
        >
          {submitting ? "Importing…" : "Import campaigns"}
        </button>
        <button
          onClick={() => { setCsv(""); setResult(null); setParsed(null); }}
          className="btn btn-ghost"
        >
          Clear
        </button>
      </div>

      {result && !result.error && (
        <div className={`rounded p-3 text-sm ${result.rejected > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          ✓ Imported <strong>{result.accepted}</strong> campaign{result.accepted === 1 ? "" : "s"}.
          {result.rejected > 0 && (
            <>
              {" "}Rejected <strong>{result.rejected}</strong> row(s):
              <ul className="list-disc list-inside mt-1 text-xs">
                {result.errors.slice(0, 10).map((e: any, i: number) => (
                  <li key={i}>line {e.line}: {e.reason}</li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-2 text-xs">Redirecting to campaigns list…</div>
        </div>
      )}

      {result?.error && (
        <div className="rounded p-3 text-sm bg-rose-50 text-rose-900">
          ✕ {result.error}
        </div>
      )}
    </div>
  );
}

function parseCsv(s: string): ParseResult {
  if (!s.trim()) return { header: [], rows: [], error: null };
  const lines = s.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) {
    return { header: lines[0]?.split(",").map((c) => c.trim()) ?? [], rows: [], error: "need at least one data row" };
  }
  const header = lines[0].split(",").map((c) => c.trim());
  const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
  return { header, rows, error: null };
}
