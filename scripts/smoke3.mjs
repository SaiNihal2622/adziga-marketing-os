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
  return { url, status: res.status };
}

const ids = [
  "/app/clients/cmu619dmo000ybonn6uv7n2dm",
  "/app/campaigns/cmu619doz001gbonnlmws8g1j",
  "/app/leads/cmu619dwk002pbonn99vxuqeq",
  "/app/creatives/cmu619dvx002lbonnju92prpi",
  "/app/events/cmu619e3000agbonnvi2uw53l",
  "/app/strategy/cmu619dnl0014bonnje5eem0q",
  "/app/reports/cmu619e4s00axbonnyq6lkils",
  "/app/experiments/cmu619e4900arbonn3boqmwuf",
  "/app/influencers/cmu619e3y00albonnos87t8oq",
  "/app/requests/cmu619e5200b0bonn5yxjpc9e"
];

(async () => {
  const cookies = await login("mm@adziga.in", "adziga123");
  console.log("=== Detail page checks ===");
  for (const u of ids) {
    const r = await check(cookies, u);
    console.log(r.url.padEnd(80), "->", r.status);
  }

  // Test AI Assistant with different queries
  console.log("\n=== AI Assistant multi-query ===");
  const queries = [
    "Why did CPL increase last week?",
    "Summarize September performance",
    "What's our current ROAS?",
    "Status of active campaigns",
    "How many qualified leads came from events?",
    "Pause the Google campaign"
  ];
  for (const q of queries) {
    const r = await fetch(base + "/api/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ question: q })
    });
    const j = await r.json();
    console.log("\nQ:", q);
    console.log("A:", (j.response || "").substring(0, 200));
  }
})();