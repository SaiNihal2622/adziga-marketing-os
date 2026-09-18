"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

type Props = {
  userName: string;
  userEmail: string;
  role: string;
  orgName: string;
  tier: string;
  notifCount: number;
  requestsCount: number;
  tasksCount: number;
};

export function TopBar({ userName, userEmail, role, orgName, tier, notifCount, requestsCount, tasksCount }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-ink-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-ink-700">{orgName}</h2>
        <span className="badge badge-neutral">{tier === "ZIGA_PLUS" ? "Ziga+" : tier === "PRO" ? "Pro" : "Free"}</span>
      </div>

      <div className="flex items-center gap-2">
        <Search />
        <Link href="/app/requests" className="btn btn-ghost btn-sm hidden md:inline-flex relative">
          Requests
          {requestsCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-brand-600 text-white">
              {requestsCount}
            </span>
          )}
        </Link>
        <Link href="/app/tasks" className="btn btn-ghost btn-sm hidden md:inline-flex relative">
          Tasks
          {tasksCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-ink-900 text-white">
              {tasksCount}
            </span>
          )}
        </Link>

        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-semibold">
              {(userName || userEmail)[0]?.toUpperCase()}
            </div>
            <span className="hidden md:inline ml-2">{userName.split(" ")[0]}</span>
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger-500 text-white text-[10px] flex items-center justify-center">
                {notifCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-56 card p-2 shadow-lg z-50">
              <div className="px-2 py-2 border-b border-ink-100">
                <div className="font-medium truncate">{userName}</div>
                <div className="text-xs text-ink-500 truncate">{userEmail}</div>
                <div className="text-xs text-ink-500 mt-0.5">{role}</div>
              </div>
              <Link href="/app/audit" className="block px-2 py-2 text-sm hover:bg-ink-50 rounded">My activity</Link>
              <Link href="/app/notifications" className="block px-2 py-2 text-sm hover:bg-ink-50 rounded">
                Notifications <span className="text-xs text-ink-500">({notifCount})</span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-left px-2 py-2 text-sm hover:bg-ink-50 rounded text-danger-600"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);

  async function run(q: string) {
    if (!q || q.length < 2) { setResults(null); return; }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setResults(await res.json());
  }

  useEffect(() => {
    const t = setTimeout(() => run(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative hidden md:block">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search clients, campaigns, leads..."
        className="input pl-8 w-72"
      />
      <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      {results && results.length > 0 && (
        <div className="absolute top-full mt-1 w-96 card p-2 shadow-lg z-40 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <Link key={`${r.kind}-${r.id}`} href={r.href} className="block px-2 py-2 hover:bg-ink-50 rounded text-sm">
              <div className="font-medium truncate">{r.title}</div>
              <div className="text-xs text-ink-500">{r.kind} - {r.subtitle}</div>
            </Link>
          ))}
        </div>
      )}
      {results && results.length === 0 && (
        <div className="absolute top-full mt-1 w-72 card p-3 text-xs text-ink-500 shadow-lg z-40">No results.</div>
      )}
    </div>
  );
}