"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Role, type OrgTier } from "@/lib/constants";
import { roleLabel } from "@/lib/format";

type NavItem = { label: string; href: string; icon: React.ReactNode };

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  overview: <Icon d="M3 12L12 3l9 9M5 10v10h14V10" />,
  orchestrate: <Icon d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />,
  intelligence: <Icon d="M12 2a10 10 0 0 0-7 17l7 5 7-5a10 10 0 0 0-7-17M12 8v4M12 16h.01" />,
  connectors: <Icon d="M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0M3 12h6M15 12h6M12 3v6M12 15v6" />,
  clients: <Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  campaigns: <Icon d="M3 11l18-8v18l-18-8v-2zM7 13v4M11 13v4M15 13v4" />,
  strategy: <Icon d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
  creatives: <Icon d="M2 3h20v14H2zM8 21h8M12 17v4M7 11l3-3 3 3 5-5" />,
  leads: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  crm: <Icon d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />,
  events: <Icon d="M3 5h18v16H3zM8 3v4M16 3v4M3 11h18" />,
  influencers: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  experiments: <Icon d="M9 3h6M10 3v6L4 20a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-11V3M7 14h10" />,
  analytics: <Icon d="M3 3v18h18M7 16l4-4 4 4 5-5" />,
  reports: <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />,
  tasks: <Icon d="M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  requests: <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  automations: <Icon d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />,
  ai: <Icon d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v3a2 2 0 0 0 1 1.73V17a2 2 0 0 0 2 2h2v1a2 2 0 1 0 4 0v-1h2a2 2 0 0 0 2-2v-3.27A2 2 0 0 0 18 12V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-2-3.46z" />,
  admin: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  audit: <Icon d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM11 8v6M11 16h.01" />,
  integrations: <Icon d="M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM3 12h6M15 12h6" />,
  billing: <Icon d="M3 6h18v12H3zM3 10h18M7 15h2M11 15h6" />,
};

function navItemsFor(names: string[]): NavItem[] {
  const map: Record<string, { href: string; icon: React.ReactNode }> = {
    Overview:    { href: "/app/overview",    icon: ICONS.overview },
    Orchestrate: { href: "/app/orchestrate", icon: ICONS.orchestrate },
    Intelligence:{ href: "/app/intelligence", icon: ICONS.intelligence },
    Connectors:  { href: "/app/connectors",  icon: ICONS.connectors },
    Clients:     { href: "/app/clients",     icon: ICONS.clients },
    Campaigns:   { href: "/app/campaigns",   icon: ICONS.campaigns },
    Strategy:    { href: "/app/strategy",    icon: ICONS.strategy },
    Creatives:   { href: "/app/creatives",   icon: ICONS.creatives },
    Leads:       { href: "/app/leads",       icon: ICONS.leads },
    CRM:         { href: "/app/crm",         icon: ICONS.crm },
    Events:      { href: "/app/events",      icon: ICONS.events },
    Influencers: { href: "/app/influencers", icon: ICONS.influencers },
    Experiments: { href: "/app/experiments", icon: ICONS.experiments },
    Analytics:   { href: "/app/analytics",   icon: ICONS.analytics },
    Reports:     { href: "/app/reports",     icon: ICONS.reports },
    Tasks:       { href: "/app/tasks",       icon: ICONS.tasks },
    Requests:    { href: "/app/requests",    icon: ICONS.requests },
    Automations: { href: "/app/automations", icon: ICONS.automations },
    "AI Assistant": { href: "/app/ai",       icon: ICONS.ai },
    Admin:       { href: "/app/admin",       icon: ICONS.admin },
    Audit:       { href: "/app/audit",       icon: ICONS.audit },
    Integrations:{ href: "/app/admin/integrations", icon: ICONS.integrations },
    Billing:     { href: "/app/admin/billing", icon: ICONS.billing }
  };
  return names.map((n) => ({ label: n, ...(map[n] || { href: "/app", icon: ICONS.audit }) }));
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
    <aside className="w-64 shrink-0 bg-ink-950 text-ink-100 flex flex-col border-r border-white/5">
      <div className="px-5 py-5 hairline-b border-white/5">
        <Link href="/" className="flex items-center gap-2 group">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 13L9 7L13 11L21 3" stroke="#5a85ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="2" fill="#5a85ff" />
            <circle cx="13" cy="11" r="2" fill="#5a85ff" />
            <circle cx="21" cy="3" r="2" fill="#e879f9" />
          </svg>
          <span className="font-semibold">Adziga</span>
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <div className="size-6 rounded-md bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-[10px] font-semibold tabular-nums text-white">
            {orgName.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-xs text-ink-300 truncate flex-1">{orgName}</div>
        </div>
        <div className="mt-2">
          <TierBadge tier={tier} />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scroll-v0">
        {opItems.length > 0 && (
          <NavSection title="Operations" items={opItems} path={path} />
        )}
        {clItems.length > 0 && (
          <NavSection title="Client Portal" items={clItems} path={path} />
        )}
      </nav>

      <div className="px-5 py-4 hairline-t border-white/5 text-xs">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-[10px] font-semibold text-white">
            {roleLabel(role).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-ink-500 text-[10px] uppercase tracking-wide">Signed in as</div>
            <div className="font-medium truncate mt-0.5">{roleLabel(role)}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavSection({ title, items, path }: { title: string; items: NavItem[]; path: string }) {
  return (
    <div>
      <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <NavLink key={it.href} item={it} active={path === it.href || path.startsWith(it.href + "/")} />
        ))}
      </ul>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-100 ${
          active
            ? "bg-brand-600 text-white shadow-sm shadow-brand-500/20"
            : "text-ink-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className={active ? "text-white" : "text-ink-500 group-hover:text-ink-300"}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

function TierBadge({ tier }: { tier: OrgTier }) {
  const map = {
    FREE: { bg: "bg-ink-800 text-ink-300 border-ink-700", label: "Free" },
    PRO: { bg: "bg-brand-500/15 text-brand-300 border-brand-500/30", label: "Pro" },
    ZIGA_PLUS: { bg: "bg-accent-500/15 text-accent-300 border-accent-500/30", label: "Ziga Plus" }
  } as const;
  const t = map[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${t.bg}`}>
      {t.label}
    </span>
  );
}
