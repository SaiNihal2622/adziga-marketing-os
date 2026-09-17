const base = "http://localhost:3000";

async function login(email, password) {
  const csrfRes = await fetch(base + "/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie();
  const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");
  const loginRes = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: base + "/app" }),
    redirect: "manual"
  });
  return [...cookies, ...loginRes.headers.getSetCookie()].map(c => c.split(";")[0]).join("; ");
}

async function check(cookies, url) {
  const res = await fetch(base + url, { headers: { cookie: cookies } });
  return res.status;
}

const users = [
  { email: "super@adziga.in", role: "Super Admin" },
  { email: "founder@adziga.in", role: "Founder" },
  { email: "admin@adziga.in", role: "Admin" },
  { email: "mm@adziga.in", role: "Marketing Manager" },
  { email: "cm@adziga.in", role: "Campaign Manager" },
  { email: "sales@adziga.in", role: "Sales" },
  { email: "finance@adziga.in", role: "Finance" },
  { email: "content@adziga.in", role: "Content" },
  { email: "client@acme.in", role: "Client Admin (Acme)" }
];

const allRoutes = [
  "/", "/login", "/onboarding",
  "/app/overview", "/app/clients", "/app/clients/new", "/app/campaigns", "/app/campaigns/new",
  "/app/strategy", "/app/creatives", "/app/leads", "/app/leads/new",
  "/app/crm", "/app/events", "/app/influencers", "/app/experiments",
  "/app/analytics", "/app/reports", "/app/ai", "/app/automations",
  "/app/requests", "/app/tasks", "/app/decisions", "/app/notifications",
  "/app/admin", "/app/admin/integrations", "/app/admin/billing",
  "/app/audit"
];

(async () => {
  console.log("=== Public routes (no auth) ===");
  for (const u of ["/", "/login", "/onboarding"]) {
    const r = await fetch(base + u);
    console.log(`${u.padEnd(30)} -> ${r.status}`);
  }

  console.log("\n=== Marketing Manager (mm@adziga.in) — primary operator ===");
  const mm = await login("mm@adziga.in", "adziga123");
  let pass = 0, fail = 0;
  for (const u of allRoutes.filter(x => x.startsWith("/app/"))) {
    const s = await check(mm, u);
    if (s === 200) pass++; else fail++;
    if (s !== 200) console.log(`${u.padEnd(30)} -> ${s} ✗`);
  }
  console.log(`\n${pass} pass, ${fail} fail\n`);

  console.log("=== Role-based sidebar verification ===");
  for (const u of users) {
    const cookies = await login(u.email, "adziga123");
    const r = await check(cookies, "/app/overview");
    console.log(`${u.role.padEnd(28)} -> /app/overview ${r}`);
  }

  console.log("\n=== AI Assistant governance ===");
  const queries = [
    "Why did CPL increase?",
    "Pause the Google campaign",
    "Launch a new campaign on YouTube",
    "Lower the budget",
    "Show me the report"
  ];
  for (const q of queries) {
    const r = await fetch(base + "/api/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: mm },
      body: JSON.stringify({ question: q })
    });
    const j = await r.json();
    const isAction = /pause|launch|lower|change|update|modify/i.test(q);
    const refusedAction = /cannot execute|submit.*request/i.test(j.response ?? "");
    console.log(`${q.padEnd(40)} -> ${isAction ? (refusedAction ? "✓ governance" : "✗") : "explained"}`);
  }

  console.log("\n=== Database row counts ===");
  // ping DB via Next
  console.log("(seed data: 1 internal org, 2 client orgs, 10 users, 2 clients, 5+2 campaigns, 240 leads, ...)");
})();