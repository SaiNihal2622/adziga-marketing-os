import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
  breadcrumbs
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="text-xs text-ink-500 mb-2 flex items-center gap-1.5">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                {b.href ? <a href={b.href} className="hover:text-brand-600">{b.label}</a> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-600 mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}