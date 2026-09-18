"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtINR, fmtNum, relTime } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { EmptyState } from "../_components/empty-state";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string;
  status: string;
  score: number;
  revenue: number;
  ownerId: string | null;
  lastContactAt: string | null;
  updatedAt: string;
  createdAt: string;
  client: { id: string; businessName: string } | null;
  campaign: { name: string } | null;
};

type Owner = { name: string | null; email: string | null };

// ──────────────────────────────────────────────────────────────────────────
// Lifecycle + visual metadata
// ──────────────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: Array<{ key: string; label: string; tone: string; dot: string }> = [
  { key: "NEW", label: "New", tone: "text-brand-700", dot: "bg-brand-500" },
  { key: "CONTACTED", label: "Contacted", tone: "text-amber-700", dot: "bg-amber-500" },
  { key: "QUALIFIED", label: "Qualified", tone: "text-brand-700", dot: "bg-brand-500" },
  { key: "MEETING_SCHEDULED", label: "Meeting", tone: "text-brand-700", dot: "bg-brand-500" },
  { key: "PROPOSAL", label: "Proposal", tone: "text-amber-700", dot: "bg-amber-500" },
  { key: "WON", label: "Won", tone: "text-emerald-700", dot: "bg-emerald-500" },
  { key: "LOST", label: "Lost", tone: "text-rose-700", dot: "bg-rose-500" }
];

const STATUS_BADGE: Record<string, string> = {
  NEW: "badge-brand",
  CONTACTED: "badge-warning",
  QUALIFIED: "badge-brand",
  MEETING_SCHEDULED: "badge-brand",
  PROPOSAL: "badge-warning",
  WON: "badge-success",
  LOST: "badge-danger"
};

const SOURCE_ICON: Record<string, { label: string; svg: JSX.Element }> = {
  META_AD: {
    label: "Meta",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
    )
  },
  GOOGLE_AD: {
    label: "Google",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c4.42 0 8.17-2.87 9.5-6.84H12v-3h10c.1.5.17 1 .17 1.5 0 5.24-4.26 9.5-9.5 9.5C7.05 23.16 2 18.16 2 12S7.05.84 12 .84c2.43 0 4.66.92 6.36 2.42l-2.13 2.13C15.07 4.42 13.6 3.7 12 3.7c-4.59 0-8.3 3.71-8.3 8.3s3.71 8.3 8.3 8.3c3.34 0 6.16-1.96 7.46-4.78H12v-3h10.46c.4 1.04.62 2.18.62 3.48z"/></svg>
    )
  },
  INFLUENCER: {
    label: "Influencer",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8"/></svg>
    )
  },
  EVENT: {
    label: "Event",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
    )
  },
  WHATSAPP: {
    label: "WhatsApp",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 14.7c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1s-1.2-.4-2.3-1.4c-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.2 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
    )
  },
  ORGANIC: {
    label: "Organic",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
    )
  },
  DIRECT: {
    label: "Direct",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
    )
  },
  REFERRAL: {
    label: "Referral",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 11l6-4M9 13l6 4"/></svg>
    )
  },
  EMAIL: {
    label: "Email",
    svg: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
    )
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function initials(input: string | null | undefined): string {
  const src = (input ?? "").trim();
  if (!src) return "??";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function avatarTone(seed: string | null | undefined): string {
  const palette = [
    "from-brand-500 to-accent-500",
    "from-emerald-500 to-cyan-500",
    "from-amber-500 to-rose-500",
    "from-violet-500 to-fuchsia-500",
    "from-sky-500 to-indigo-500",
    "from-teal-500 to-emerald-500"
  ];
  const s = (seed ?? "?").charCodeAt(0) || 0;
  return palette[s % palette.length];
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-brand-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function formatIN(v: number): string {
  return fmtINR(v);
}

// ──────────────────────────────────────────────────────────────────────────
// Avatar
// ──────────────────────────────────────────────────────────────────────────

function Avatar({
  name,
  email,
  size = "md",
  className = ""
}: {
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const label = name || email || "?";
  const sizeCls = size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-9 text-[13px]";
  return (
    <div className={`relative shrink-0 select-none rounded-full bg-gradient-to-br ${avatarTone(label)} ${sizeCls} flex items-center justify-center text-white font-semibold ${className}`}>
      {initials(label)}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors focus-ring ${
        active
          ? "bg-ink-900 text-white border border-ink-900"
          : "bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 hover:border-ink-300"
      }`}
    >
      <span>{label}</span>
      <span className={`tabular-nums text-[11px] ${active ? "text-white/70" : "text-ink-500"}`}>{fmtNum(count)}</span>
    </button>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full bg-ink-100 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-ink-600 w-6 text-right">{pct}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Drawer
// ──────────────────────────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  owner,
  onClose
}: {
  lead: Lead;
  owner: Owner | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"activity" | "notes" | "ai">("activity");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-40 fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-xl border-l border-ink-200 flex flex-col overflow-hidden slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 hairline-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar name={lead.name} email={lead.email} size="lg" />
              <div className="min-w-0">
                <div className="font-semibold text-lg tracking-tight truncate">{lead.name || lead.email || "Unknown lead"}</div>
                <div className="text-sm text-ink-500 truncate">{lead.client?.businessName ?? "—"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`badge ${STATUS_BADGE[lead.status] ?? "badge-neutral"}`}>
                    {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
                  </span>
                  {lead.city && <span className="badge badge-neutral">{lead.city}</span>}
                  <span className="badge badge-neutral tabular-nums">Score {lead.score}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="size-8 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-ring inline-flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
          </div>

          {/* Contact row */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600">
            {lead.email && <span className="truncate">{lead.email}</span>}
            {lead.phone && <span className="tabular-nums">{lead.phone}</span>}
            {owner?.name && <span className="text-ink-500">· Owner: {owner.name}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 hairline-b">
          <div className="flex gap-1">
            {(["activity", "notes", "ai"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors focus-ring ${
                  tab === t
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                {t === "activity" ? "Activity" : t === "notes" ? "Notes" : "AI Suggestions"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-v0 px-6 py-5">
          {tab === "activity" && (
            <ol className="space-y-5">
              {[
                { tone: "bg-brand-500", title: `Lead created from ${lead.source?.replace("_", " ")?.toLowerCase()}`, when: lead.createdAt },
                ...(lead.lastContactAt
                  ? [{ tone: "bg-amber-500", title: "Outreach call logged", when: lead.lastContactAt }]
                  : []),
                { tone: "bg-emerald-500", title: `Status: ${LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}`, when: lead.updatedAt }
              ].map((ev, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`size-2 rounded-full ${ev.tone}`} />
                    {i < 2 && <div className="w-px flex-1 bg-ink-200 mt-1" />}
                  </div>
                  <div className="pb-2 -mt-0.5">
                    <div className="text-sm">{ev.title}</div>
                    <div className="text-[11px] text-ink-500 tabular-nums mt-0.5">{relTime(ev.when)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {tab === "notes" && (
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={6}
                placeholder="Add a note about this lead (visible to your team)…"
                className="input resize-none focus-ring"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-500">Notes are saved to the lead record.</span>
                <button className="btn btn-primary btn-sm focus-ring" disabled={!note.trim()}>
                  Save note
                </button>
              </div>
            </div>
          )}

          {tab === "ai" && (
            <div className="space-y-3">
              <div className="card-v0 p-4 hover-overlay-host relative overflow-hidden">
                <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold text-accent-600">
                  <span className="size-1.5 rounded-full bg-accent-500 animate-live" />
                  AI
                </div>
                <div className="font-medium text-sm pr-12">Send a follow-up email based on last interaction</div>
                <p className="text-xs text-ink-600 mt-1">
                  Personalized WhatsApp + email sequence referencing the {lead.source?.replace("_", " ")?.toLowerCase()} campaign and
                  the {lead.client?.businessName ?? "client"} offer. Estimated 22% lift in reply rate.
                </p>
                <div className="flex gap-2 mt-3">
                  <button className="btn btn-primary btn-sm focus-ring">Apply</button>
                  <button className="btn btn-secondary btn-sm focus-ring">Dismiss</button>
                </div>
              </div>
              <div className="card-v0 p-4 hover-overlay-host relative overflow-hidden">
                <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold text-accent-600">
                  <span className="size-1.5 rounded-full bg-accent-500 animate-live" />
                  AI
                </div>
                <div className="font-medium text-sm pr-12">Schedule a discovery call on the next available slot</div>
                <p className="text-xs text-ink-600 mt-1">
                  Suggests a 30-min slot next Tuesday at 11:00 IST based on the lead’s stated timezone and your calendar availability.
                </p>
                <div className="flex gap-2 mt-3">
                  <button className="btn btn-primary btn-sm focus-ring">Apply</button>
                  <button className="btn btn-secondary btn-sm focus-ring">Dismiss</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="hairline-t px-6 py-3 bg-ink-50 flex items-center justify-between gap-2">
          <Link href={`/app/leads/${lead.id}`} className="text-xs font-medium text-brand-700 hover:underline focus-ring rounded">
            Edit lead
          </Link>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm focus-ring inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
              Email
            </button>
            <button className="btn btn-primary btn-sm focus-ring inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
              Schedule meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Table view
// ──────────────────────────────────────────────────────────────────────────

function TableView({
  leads,
  ownerMap,
  onSelect
}: {
  leads: Lead[];
  ownerMap: Record<string, Owner>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card-v0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="hairline-b">
              {[
                { label: "Name", sortable: true },
                { label: "Company", sortable: true },
                { label: "Status", sortable: true },
                { label: "Source", sortable: false },
                { label: "Score", sortable: true },
                { label: "Owner", sortable: false },
                { label: "Last activity", sortable: true },
                { label: "Value", sortable: true }
              ].map((h) => (
                <th
                  key={h.label}
                  className="text-left text-[11px] uppercase tracking-wide text-ink-500 font-semibold px-4 py-2.5 bg-ink-50/60"
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {h.sortable && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className="text-ink-400">
                        <path d="M3 5l3-3 3 3M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const owner = l.ownerId ? ownerMap[l.ownerId] : null;
              const src = SOURCE_ICON[l.source];
              return (
                <tr
                  key={l.id}
                  onClick={() => onSelect(l.id)}
                  className="hairline-b cursor-pointer transition-colors hover:bg-ink-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={l.name} email={l.email} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.name || l.email || "Unknown"}</div>
                        <div className="text-[11px] text-ink-500 truncate">{l.email ?? l.phone ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-ink-800 truncate max-w-[160px]">{l.client?.businessName ?? "—"}</div>
                    {l.campaign?.name && <div className="text-[11px] text-ink-500 truncate max-w-[160px]">{l.campaign.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[l.status] ?? "badge-neutral"}`}>
                      {LEAD_STATUS_LABELS[l.status as keyof typeof LEAD_STATUS_LABELS] ?? l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-700">
                      <span className="text-ink-500">{src?.svg}</span>
                      {src?.label ?? l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={l.score} tone={scoreTone(l.score)} />
                  </td>
                  <td className="px-4 py-3">
                    <Avatar name={owner?.name} email={owner?.email} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600 tabular-nums whitespace-nowrap">
                    {l.lastContactAt ? relTime(l.lastContactAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-ink-900 whitespace-nowrap">
                    {formatIN(Number(l.revenue) || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Kanban view
// ──────────────────────────────────────────────────────────────────────────

function KanbanCard({
  lead,
  owner,
  onSelect
}: {
  lead: Lead;
  owner: Owner | null;
  onSelect: () => void;
}) {
  const src = SOURCE_ICON[lead.source];
  return (
    <div
      onClick={onSelect}
      className="card-v0 hover-overlay-host p-3 cursor-pointer relative hover:shadow-sm transition-shadow"
    >
      <div className="hover-overlay rounded-lg" />
      <div className="relative">
        <div className="flex items-start gap-2.5">
          <Avatar name={lead.name} email={lead.email} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{lead.name || lead.email || "Unknown"}</div>
            <div className="text-[11px] text-ink-500 truncate">{lead.client?.businessName ?? "—"}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`badge ${
              lead.score >= 80 ? "badge-success" : lead.score >= 60 ? "badge-brand" : lead.score >= 40 ? "badge-warning" : "badge-danger"
            } tabular-nums`}
          >
            {lead.score}
          </span>
          <span className="tabular-nums text-xs font-semibold text-ink-900">{formatIN(Number(lead.revenue) || 0)}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span className="text-ink-400">{src?.svg}</span>
            {src?.label ?? lead.source}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="size-6 rounded inline-flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-ring">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
            </button>
            <button className="size-6 rounded inline-flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-ring">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanView({
  leads,
  ownerMap,
  onSelect
}: {
  leads: Lead[];
  ownerMap: Record<string, Owner>;
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const col of KANBAN_COLUMNS) m[col.key] = [];
    for (const l of leads) {
      (m[l.status] ?? (m[l.status] = [])).push(l);
    }
    return m;
  }, [leads]);

  return (
    <div className="overflow-x-auto pb-4 -mx-2 px-2 scroll-v0">
      <div className="flex gap-3 min-w-max">
        {KANBAN_COLUMNS.map((col) => {
          const items = grouped[col.key] ?? [];
          const total = items.reduce((s, l) => s + Number(l.revenue || 0), 0);
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-semibold ${col.tone}`}>{col.label}</span>
                  <span className="badge badge-neutral tabular-nums text-[10px]">{fmtNum(items.length)}</span>
                </div>
                <span className="text-[10px] text-ink-500 tabular-nums">{formatIN(total)}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.length === 0 && (
                  <div className="card-v0 border-dashed p-4 text-center text-[11px] text-ink-400">
                    No leads in {col.label.toLowerCase()}
                  </div>
                )}
                {items.slice(0, 8).map((l) => (
                  <KanbanCard
                    key={l.id}
                    lead={l}
                    owner={l.ownerId ? ownerMap[l.ownerId] ?? null : null}
                    onSelect={() => onSelect(l.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pagination dots
// ──────────────────────────────────────────────────────────────────────────

function PaginationDots({ total, pageSize }: { total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(0);
  if (pages <= 1) return <div className="flex gap-1.5">{[0].map((i) => <span key={i} className="size-1.5 rounded-full bg-ink-900" />)}</div>;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: pages }).map((_, i) => (
        <button
          key={i}
          onClick={() => setPage(i)}
          aria-label={`Page ${i + 1}`}
          className={`size-1.5 rounded-full transition-colors focus-ring ${i === page ? "bg-ink-900" : "bg-ink-300 hover:bg-ink-400"}`}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main workspace
// ──────────────────────────────────────────────────────────────────────────

export function LeadsWorkspace({
  initialLeads,
  ownerMap
}: {
  initialLeads: Lead[];
  ownerMap: Record<string, Owner>;
}) {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Counts (over ALL leads, not the filtered set)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: initialLeads.length };
    for (const l of initialLeads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [initialLeads]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = initialLeads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.client?.businessName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [initialLeads, search, statusFilter]);

  const displayed = filtered.slice(0, 20);
  const selectedLead = selectedId ? initialLeads.find((l) => l.id === selectedId) ?? null : null;
  const selectedOwner = selectedLead?.ownerId ? ownerMap[selectedLead.ownerId] ?? null : null;

  if (initialLeads.length === 0) {
    return (
      <div className="card-v0">
        <EmptyState
          illustration="lead"
          title="No leads in this view"
          description="Connect a campaign source or create a lead manually to start populating your pipeline."
          primaryAction={{ label: "+ New lead", href: "/app/leads/new" }}
          secondaryAction={{ label: "View campaigns", href: "/app/campaigns" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      {/* ───── Header ───── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-ink-600 mt-1 tabular-nums">
            {fmtNum(initialLeads.length)} leads · {fmtINR(filtered.reduce((s, l) => s + Number(l.revenue || 0), 0))} pipeline value
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, company…"
              className="input pl-9 w-64 lg:w-80 focus-ring"
            />
          </div>

          {/* View toggle */}
          <div className="inline-flex items-center rounded-lg border border-ink-200 bg-white p-0.5 h-9">
            <button
              onClick={() => setView("table")}
              className={`px-3 h-8 rounded-md text-xs font-medium transition-colors focus-ring inline-flex items-center gap-1.5 ${
                view === "table" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18"/></svg>
              Table
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`px-3 h-8 rounded-md text-xs font-medium transition-colors focus-ring inline-flex items-center gap-1.5 ${
                view === "kanban" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="6" height="16" rx="1"/><rect x="10" y="4" width="6" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>
              Kanban
            </button>
          </div>

          <Link href="/app/leads/new" className="btn btn-primary btn-sm focus-ring inline-flex items-center gap-1.5 h-9">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            New lead
          </Link>
        </div>
      </div>

      {/* ───── Filter chips ───── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "NEW", label: "New" },
          { key: "QUALIFIED", label: "Qualified" },
          { key: "MEETING_SCHEDULED", label: "Meeting" },
          { key: "WON", label: "Won" }
        ].map((c) => (
          <FilterChip
            key={c.key}
            label={c.label}
            count={counts[c.key] ?? 0}
            active={statusFilter === c.key}
            onClick={() => setStatusFilter(c.key)}
          />
        ))}
        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-white text-ink-700 border border-dashed border-ink-300 hover:bg-ink-50 hover:border-ink-400 focus-ring">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M10 18h4" strokeLinecap="round"/></svg>
          Advanced filters
        </button>
        {search && (
          <button onClick={() => setSearch("")} className="text-[11px] text-ink-500 hover:text-ink-800 ml-1 focus-ring rounded">
            Clear search
          </button>
        )}
      </div>

      {/* ───── Content ───── */}
      {view === "table" ? (
        <TableView leads={displayed} ownerMap={ownerMap} onSelect={setSelectedId} />
      ) : (
        <KanbanView leads={filtered} ownerMap={ownerMap} onSelect={setSelectedId} />
      )}

      {/* ───── Footer ───── */}
      <div className="flex items-center justify-between text-xs text-ink-500 pt-1">
        <div className="tabular-nums">
          Showing <span className="text-ink-800 font-medium">{fmtNum(displayed.length)}</span> of{" "}
          <span className="text-ink-800 font-medium">{fmtNum(filtered.length)}</span> leads
          {search || statusFilter !== "all" ? " (filtered)" : ""}
        </div>
        <PaginationDots total={filtered.length} pageSize={20} />
      </div>

      {/* ───── Drawer ───── */}
      {selectedLead && (
        <LeadDrawer lead={selectedLead} owner={selectedOwner} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
