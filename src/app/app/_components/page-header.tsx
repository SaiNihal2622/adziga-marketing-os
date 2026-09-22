import type { ReactNode } from "react";

// Editorial page header. Used at the top of every /app/* page.
// Composes breadcrumbs + eyebrow + title + subtitle + actions.

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  right,
  breadcrumbs
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-6 pb-6 mb-6 border-b border-ink-200/70">
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="text-xs text-ink-500 mb-2 flex items-center gap-1.5">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-300">/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-brand-600 transition-colors">{b.label}</a>
                ) : (
                  <span className="text-ink-700">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-tighter text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-2 max-w-3xl leading-relaxed">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0 pt-1">{right}</div>}
    </div>
  );
}
