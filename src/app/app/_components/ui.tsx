// Adziga — Polished UI component library
// Server-renderable primitives. Editorial / modern aesthetic.

import type { ReactNode } from "react";

// ──────────────────────────────────────────────────────────────────────────
// Button — primary | secondary | ghost | danger, sizes sm | md | lg
// ──────────────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  href,
  onClick,
  type,
  className = ""
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  type?: "submit" | "button";
  className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-ring whitespace-nowrap";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm hover:shadow-brand-soft",
    secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200 active:bg-ink-300",
    ghost: "text-ink-700 hover:bg-ink-100 active:bg-ink-200",
    danger: "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-sm",
    outline: "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 hover:border-ink-300",
    accent: "bg-accent-500 text-white hover:bg-accent-600 shadow-sm"
  } as const;

  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  if (href) return <a href={href} className={cls}>{children}</a>;
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled || loading} className={cls}>
      {loading && (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Card — refined editorial card with subtle border + hover state
// ──────────────────────────────────────────────────────────────────────────

export function Card({
  children,
  padding = "md",
  hover = false,
  href,
  onClick,
  className = ""
}: {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const pads = { none: "", sm: "p-4", md: "p-5", lg: "p-7" };
  const cls = `bg-white dark:bg-ink-900 rounded-xl border border-ink-200/70 dark:border-ink-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${pads[padding]} ${hover ? "transition-all duration-200 hover:border-ink-300 hover:shadow-card-hover cursor-pointer" : ""} ${className}`;
  if (href) return <a href={href} className={cls + " block"}>{children}</a>;
  if (onClick) return <button onClick={onClick} className={cls + " text-left w-full"}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

// ──────────────────────────────────────────────────────────────────────────
// Badge — with variants
// ──────────────────────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = "neutral",
  className = "",
  dot = false
}: {
  children: ReactNode;
  variant?: "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
  dot?: boolean;
}) {
  const variants = {
    neutral: "bg-ink-100 text-ink-700 border border-ink-200",
    brand: "bg-brand-50 text-brand-700 border border-brand-200",
    accent: "bg-accent-50 text-accent-700 border border-accent-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-rose-50 text-rose-700 border border-rose-200",
    info: "bg-sky-50 text-sky-700 border border-sky-200"
  } as const;
  const dotColors = {
    neutral: "bg-ink-400",
    brand: "bg-brand-500",
    accent: "bg-accent-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-sky-500"
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-tight ${variants[variant]} ${className}`}>
      {dot && <span className={`inline-block size-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Input — labeled form input with error/help
// ──────────────────────────────────────────────────────────────────────────

export function Input({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  disabled,
  error,
  help,
  autoComplete,
  multiline,
  rows = 3
}: {
  label?: string;
  name: string;
  type?: string;
  value?: string | number;
  onChange?: (e: any) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  help?: string;
  autoComplete?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={`input ${error ? "border-danger-500" : ""}`}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`input ${error ? "border-danger-500" : ""}`}
        />
      )}
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
      {help && !error && <p className="text-xs text-ink-500 mt-1">{help}</p>}
    </div>
  );
}

export function Select({
  label,
  name,
  value,
  onChange,
  options,
  required,
  disabled
}: {
  label?: string;
  name: string;
  value?: string;
  onChange?: (e: any) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="input"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Skeleton — loading placeholder
// ──────────────────────────────────────────────────────────────────────────

export function Skeleton({ className = "", width, height }: { className?: string; width?: string; height?: string }) {
  return (
    <div
      className={`animate-pulse bg-ink-200 rounded ${className}`}
      style={{ width: width ?? "100%", height: height ?? "1rem" }}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Toast — global notification (uses sessionStorage for demo)
// ──────────────────────────────────────────────────────────────────────────

export function Toast({ message, type = "info", onClose }: { message: string; type?: "info" | "success" | "warning" | "danger"; onClose?: () => void }) {
  const colors = {
    info: "bg-brand-50 border-brand-200 text-brand-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-rose-50 border-rose-200 text-rose-900"
  };
  return (
    <div className={`fixed bottom-4 right-4 card p-3 max-w-sm border-l-4 ${colors[type]} shadow-lg z-50`}>
      <div className="flex items-start gap-2">
        <div className="text-sm flex-1">{message}</div>
        {onClose && (
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">&times;</button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Modal — centered dialog
// ──────────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-lg w-full p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-ink-100">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 bg-ink-50 border-t border-ink-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mb-3 inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500">{icon}</div>}
      <h3 className="font-semibold text-ink-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-500 max-w-md mx-auto">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="btn btn-primary mt-4 inline-flex">{action.label}</a>
        ) : (
          <button onClick={action.onClick} className="btn btn-primary mt-4">{action.label}</button>
        )
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Toggle
// ──────────────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-ink-300"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Progress
// ──────────────────────────────────────────────────────────────────────────

export function Progress({ value, max = 100, color = "brand" }: { value: number; max?: number; color?: "brand" | "accent" | "success" | "warning" }) {
  const pct = Math.min(100, (value / max) * 100);
  const colors = {
    brand: "bg-brand-500",
    accent: "bg-accent-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500"
  };
  return (
    <div className="w-full bg-ink-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full transition-all duration-500 ${colors[color]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// KPI tile — big number with label, optional trend, optional icon
// ──────────────────────────────────────────────────────────────────────────

export function Kpi({
  label,
  value,
  delta,
  hint,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "brand" | "accent" | "success";
}) {
  const toneRing = {
    neutral: "ring-ink-200",
    brand: "ring-brand-100",
    accent: "ring-accent-100",
    success: "ring-emerald-100"
  }[tone];
  return (
    <div className={`relative rounded-xl bg-white dark:bg-ink-900 ring-1 ${toneRing} shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.08em] text-ink-500 font-semibold">{label}</div>
        {icon && <div className="text-ink-400">{icon}</div>}
      </div>
      <div className="mt-3 text-[28px] leading-[1.1] font-semibold tracking-tighter tabular-nums text-ink-900">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${delta.positive ? "text-emerald-700" : "text-rose-700"}`}>
            <span aria-hidden>{delta.positive ? "↑" : "↓"}</span>
            {delta.value}
          </span>
        )}
        {hint && <span className="text-ink-500">{hint}</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Section header — editorial page section title with optional eyebrow + actions
// ──────────────────────────────────────────────────────────────────────────

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-4 mb-5 border-b border-ink-200/70">
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.14em] text-brand-600 font-semibold mb-2">{eyebrow}</div>}
        <h2 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="text-sm text-ink-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stat row — inline key/value pair for detail pages
// ──────────────────────────────────────────────────────────────────────────

export function StatRow({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-b-0">
      <div className="text-sm text-ink-500">{label}</div>
      <div className="text-sm font-medium text-ink-900 text-right">
        {value}
        {hint && <div className="text-xs text-ink-400 font-normal">{hint}</div>}
      </div>
    </div>
  );
}