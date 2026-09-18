"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Role, type OrgTier } from "@/lib/constants";
import { roleLabel } from "@/lib/format";

type NavItem = { label: string; href: string; icon: string };

function navItemsFor(names: string[]): NavItem[] {
  const map: Record<string, { href: string; icon: string }> = {
    Overview:    { href: "/app/overview",    icon: "OV" },
    Orchestrate: { href: "/app/orchestrate", icon: "OR" },
    Intelligence:{ href: "/app/intelligence", icon: "AI" },
    Connectors:  { href: "/app/connectors",  icon: "CN" },
    Clients:     { href: "/app/clients",     icon: "CL" },
    Campaigns:   { href: "/app/campaigns",   icon: "CP" },
    Strategy:    { href: "/app/strategy",    icon: "ST" },
    Creatives:   { href: "/app/creatives",   icon: "CR" },
    Leads:       { href: "/app/leads",       icon: "LD" },
    CRM:         { href: "/app/crm",         icon: "CM" },
    Events:      { href: "/app/events",      icon: "EV" },
    Influencers: { href: "/app/influencers", icon: "IF" },
    Experiments: { href: "/app/experiments", icon: "EX" },
    Analytics:   { href: "/app/analytics",   icon: "AN" },
    Reports:     { href: "/app/reports",     icon: "RP" },
    Tasks:       { href: "/app/tasks",       icon: "TK" },
    Requests:    { href: "/app/requests",    icon: "RQ" },
    Automations: { href: "/app/automations", icon: "AU" },
    "AI Assistant": { href: "/app/ai",      icon: "AS" },
    Admin:       { href: "/app/admin",       icon: "AD" },
    Audit:       { href: "/app/audit",       icon: "LG" },
    Integrations:{ href: "/app/admin/integrations", icon: "IN" },
    Billing:     { href: "/app/admin/billing", icon: "BL" }
  };
  return names.map((n) => ({ label: n, ...(map[n] || { href: "/app", icon: "." }) }));
}

export function SidebarNav({
  operator,
  client,
  role,
  orgName,
  tier
}: {
  operator: string[];
  client: string[];
  role: Role;
  orgName: string;
  tier: OrgTier;
}) {
  const path = usePathname();
  const opItems = navItemsFor(operator);
  const clItems = navItemsFor(client);

  return (
    <aside className="w-64 shrink-0 bg-ink-950 text-ink-100 flex flex-col">
      <div className="px-5 py-5 border-b border-ink-800">
        <Link href="/" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 13L9 7L13 11L21 3" stroke="#5a85ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="2" fill="#5a85ff" />
            <circle cx="13" cy="11" r="2" fill="#5a85ff" />
            <circle cx="21" cy="3" r="2" fill="#e879f9" />
          </svg>
          <span className="font-semibold">Adziga</span>
        </Link>
        <div className="mt-3 text-xs text-ink-400 truncate">{orgName}</div>
        <div className="mt-1">
          <TierBadge tier={tier} />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin">
        {opItems.length > 0 && (
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
              Operations
            </div>
            <ul className="space-y-0.5">
              {opItems.map((it) => (
                <NavLink key={it.href} item={it} active={path === it.href || path.startsWith(it.href + "/")} />
              ))}
            </ul>
          </div>
        )}
        {clItems.length > 0 && (
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
              Client Portal
            </div>
            <ul className="space-y-0.5">
              {clItems.map((it) => (
                <NavLink key={it.href} item={it} active={path === it.href || path.startsWith(it.href + "/")} />
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-ink-800 text-xs">
        <div className="text-ink-500">Signed in as</div>
        <div className="font-medium truncate mt-1">{roleLabel(role)}</div>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          active ? "bg-brand-600 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"
        }`}
      >
        <span className="text-xs font-mono w-5 text-center">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

function TierBadge({ tier }: { tier: OrgTier }) {
  const map = {
    FREE: "bg-ink-800 text-ink-300",
    PRO: "bg-brand-500/20 text-brand-300 border border-brand-500/30",
    ZIGA_PLUS: "bg-accent-500/20 text-accent-300 border border-accent-500/30"
  } as const;
  const label = tier === "ZIGA_PLUS" ? "Ziga Plus" : tier === "PRO" ? "Pro" : "Free";
  return <span className={`badge ${map[tier]}`}>{label}</span>;
}