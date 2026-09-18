// Adziga — v0-quality empty state illustrations + wrapper
// Lightweight SVG illustrations in the v0 aesthetic.

import Link from "next/link";

type EmptyStateProps = {
  illustration?: "campaign" | "lead" | "client" | "creative" | "search" | "report" | "event" | "experiment" | "automation" | "invoice";
  title: string;
  description?: string;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
};

export function EmptyState({ illustration = "search", title, description, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 fade-in">
      <Illustration kind={illustration} />
      <h3 className="font-semibold text-base mt-4 text-ink-900">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1 max-w-md">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 mt-5">
          {primaryAction && (
            primaryAction.href
              ? <Link href={primaryAction.href} className="btn btn-primary btn-sm focus-ring">{primaryAction.label}</Link>
              : <button onClick={primaryAction.onClick} className="btn btn-primary btn-sm focus-ring">{primaryAction.label}</button>
          )}
          {secondaryAction && (
            secondaryAction.href
              ? <Link href={secondaryAction.href} className="btn btn-secondary btn-sm focus-ring">{secondaryAction.label}</Link>
              : <button onClick={secondaryAction.onClick} className="btn btn-secondary btn-sm focus-ring">{secondaryAction.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

function Illustration({ kind }: { kind: NonNullable<EmptyStateProps["illustration"]> }) {
  return (
    <div className="size-32 rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 border border-ink-200 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-bento opacity-40" />
      <div className="relative text-ink-400">
        <IllustrationSvg kind={kind} />
      </div>
    </div>
  );
}

function IllustrationSvg({ kind }: { kind: NonNullable<EmptyStateProps["illustration"]> }) {
  switch (kind) {
    case "campaign":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="14" width="36" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 18l18 9 18-9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="38" cy="10" r="3" fill="#243ff0" fillOpacity="0.2" stroke="#243ff0" strokeWidth="1.5" />
        </svg>
      );
    case "lead":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 38c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="38" cy="10" r="2" fill="#d946ef" />
        </svg>
      );
    case "client":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M14 22h20M14 28h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="22" r="2" fill="#243ff0" fillOpacity="0.3" />
        </svg>
      );
    case "creative":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 36l10-10 8 8 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="22" cy="22" r="12" stroke="currentColor" strokeWidth="1.5" />
          <path d="M31 31l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 16h16M16 22h16M16 28h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "event":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="12" width="36" height="26" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 8v8M32 8v8M6 22h36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "experiment":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M18 6h12M20 6v18l-8 14a3 3 0 0 0 3 5h18a3 3 0 0 0 3-5l-8-14V6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 28h20" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="24" cy="14" r="2" fill="#243ff0" fillOpacity="0.4" />
        </svg>
      );
    case "automation":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M24 6v4M24 38v4M6 24h4M38 24h4M11 11l3 3M34 34l3 3M11 37l3-3M34 14l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "invoice":
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M10 6h22l8 8v28H10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M32 6v8h8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 22h16M16 28h12M16 34h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

// Skeleton rows for loading states — v0-style with subtle gradient
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-gradient-to-r from-ink-100 via-ink-50 to-ink-100 animate-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

// Empty card variant — used for empty table/list bodies
export function EmptyCard({ title, description, action }: { title: string; description?: string; action?: { label: string; href: string } }) {
  return (
    <div className="card-v0 p-12 text-center">
      <EmptyState title={title} description={description} primaryAction={action} />
    </div>
  );
}
