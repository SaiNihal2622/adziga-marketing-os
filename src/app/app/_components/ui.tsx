// Adziga — Polished UI component library
// Server-renderable primitives. v0-quality aesthetic.

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
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm hover:shadow-md",
    secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200 active:bg-ink-300",
    ghost: "text-ink-700 hover:bg-ink-100 active:bg-ink-200",
    danger: "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 shadow-sm",
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
// Card — with hover lift, click action, padding variants
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
  const pads = { none: "", sm: "p-3", md: "p-5", lg: "p-7" };
  const cls = `card ${pads[padding]} ${hover ? "transition-shadow hover:shadow-md cursor-pointer" : ""} ${className}`;
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
  className = ""
}: {
  children: ReactNode;
  variant?: "neutral" | "brand" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const variants = {
    neutral: "bg-ink-100 text-ink-700 border border-ink-200",
    brand: "bg-brand-50 text-brand-700 border border-brand-200",
    accent: "bg-accent-50 text-accent-600 border border-accent-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-rose-50 text-rose-700 border border-rose-200"
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${variants[variant]} ${className}`}>
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
    brand: "bg-brand-600",
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