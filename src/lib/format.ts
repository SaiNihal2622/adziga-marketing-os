import type { OrgTier, Role } from "./constants";

export function fmtINR(n: number | bigint | null | undefined): string {
  const v = typeof n === "bigint" ? Number(n) : n ?? 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

export function fmtNum(n: number | bigint | null | undefined): string {
  const v = typeof n === "bigint" ? Number(n) : n ?? 0;
  if (Math.abs(v) >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function relTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - dt.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(dt);
}

export function safeDiv(a: number | bigint, b: number | bigint): number {
  const av = typeof a === "bigint" ? Number(a) : a;
  const bv = typeof b === "bigint" ? Number(b) : b;
  if (!bv) return 0;
  return av / bv;
}

export function ctr(clicks: number | bigint, impressions: number | bigint): number {
  return safeDiv(clicks, impressions) * 100;
}

export function cpl(spend: number, leads: number | bigint): number {
  return safeDiv(spend, leads);
}

export function roas(revenue: number, spend: number): number {
  return safeDiv(revenue, spend);
}

export function tierBadge(tier: OrgTier | string): string {
  if (tier === "ZIGA_PLUS") return "Ziga+";
  if (tier === "PRO") return "Pro";
  return "Free";
}

export function roleLabel(role: Role | string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    FOUNDER: "Founder",
    ADMIN: "Admin",
    MARKETING_MANAGER: "Marketing Manager",
    CAMPAIGN_MANAGER: "Campaign Manager",
    SALES: "Sales",
    FINANCE: "Finance",
    CONTENT: "Content",
    CLIENT_ADMIN: "Client Admin",
    CLIENT_MEMBER: "Client Member"
  };
  return map[role] ?? role;
}