// Adziga brand logo — three variants: full lockup, icon-only, wordmark.
// Uses currentColor for monochrome variants (the brand orange mark stays
// orange in all variants).
import type { CSSProperties } from "react";

export type LogoVariant = "lockup" | "icon" | "wordmark";
export type LogoTheme = "dark" | "light";

export type LogoProps = {
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** Pixel size for icon-only. Width for lockup. Defaults vary by variant. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Optional aria-label override; default uses variant. */
  ariaLabel?: string;
};

const ORANGE = "#F26B2A";
const INK = "#0A0A0A";

/** Reusable icon mark. Color is fixed (orange + white on ink). */
function IconMark({ size = 40 }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden
    >
      <rect width="256" height="256" rx="48" fill={INK} />
      {/* LEFT — white */}
      <path d="M40 28 L102 56 L40 70 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="116" cy="44" r="11" fill="#FFFFFF" />
      <path d="M30 70 L106 100 L30 116 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      <g transform="rotate(-14 70 158)">
        <rect x="36" y="148" width="80" height="20" rx="10" fill="#FFFFFF" />
      </g>
      <circle cx="76" cy="208" r="12" fill="#FFFFFF" />
      {/* RIGHT — orange */}
      <path d="M124 36 L200 70 L124 104 Z" fill={ORANGE} stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M126 120 L184 148 L126 176 Z" fill={ORANGE} stroke={ORANGE} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="216" cy="96" r="10" fill={ORANGE} />
    </svg>
  );
}

export function Logo({
  variant = "lockup",
  theme = "dark",
  size,
  className,
  style,
  ariaLabel
}: LogoProps) {
  const textColor = theme === "dark" ? "#FFFFFF" : INK;
  const taglineColor = theme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.6)";

  if (variant === "icon") {
    const s = size ?? 40;
    return (
      <span className={className} style={{ display: "inline-block", lineHeight: 0, ...style }} aria-label={ariaLabel ?? "Adziga"} role="img">
        <IconMark size={s} />
      </span>
    );
  }

  if (variant === "wordmark") {
    // Text-only mark — useful inside nav bars where the icon would be redundant.
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 8,
          fontFamily: "var(--font-display, 'Geist', system-ui, sans-serif)",
          fontWeight: 800,
          fontSize: size ?? 22,
          letterSpacing: "0.02em",
          color: textColor,
          lineHeight: 1,
          ...style
        }}
        aria-label={ariaLabel ?? "Adziga"}
        role="img"
      >
        ADZIGA
      </span>
    );
  }

  // Full lockup — icon + ADZIGA wordmark + tagline
  const iconSize = Math.round((size ?? 220) * 0.42);
  const wordmarkSize = Math.round((size ?? 220) * 0.22);
  const taglineSize = Math.round((size ?? 220) * 0.085);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round((size ?? 220) * 0.07),
        ...style
      }}
      aria-label={ariaLabel ?? "Adziga — Elevating dreams"}
      role="img"
    >
      <IconMark size={iconSize} />
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
          lineHeight: 1
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display, 'Geist', system-ui, sans-serif)",
            fontWeight: 800,
            fontSize: wordmarkSize,
            letterSpacing: "0.02em",
            color: textColor
          }}
        >
          ADZIGA
        </span>
        <span
          style={{
            marginTop: Math.round(taglineSize * 0.4),
            fontFamily: "var(--font-serif, 'Crimson Pro', Georgia, serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: taglineSize,
            letterSpacing: "0.01em",
            color: taglineColor
          }}
        >
          Elevating dreams
        </span>
      </span>
    </span>
  );
}

export default Logo;
