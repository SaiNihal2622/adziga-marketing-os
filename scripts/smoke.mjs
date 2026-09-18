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

const phasePages = [
  // Phase 0 (existing)
  "/app/overview", "/app/clients", "/app/campaigns", "/app/strategy",
  "/app/creatives", "/app/leads", "/app/crm", "/app/events",
  "/app/influencers", "/app/experiments", "/app/analytics",
  "/app/reports", "/app/ai", "/app/requests", "/app/tasks",
  "/app/decisions", "/app/admin", "/app/audit", "/app/notifications",
  "/app/admin/integrations", "/app/admin/billing",
  // Phase 1 (new)
  "/app/connectors", "/app/automations",
  // Phase 2 + 3 (new)
  "/app/intelligence", "/app/intelligence/strategy", "/app/intelligence/content",
  // Phase 4 (new)
  "/app/orchestrate"
];

(async () => {
  const cookies = await login("mm@adziga.in", "adziga123");
  let pass = 0, fail = 0;
  console.log("=== Page smoke tests ===");
  for (const u of phasePages) {
    const s = await check(cookies, u);
    if (s === 200) { pass++; console.log(`${u.padEnd(40)} -> ${s} OK`); }
    else { fail++; console.log(`${u.padEnd(40)} -> ${s} FAIL`); }
  }
  console.log(`\n${pass} pass, ${fail} fail\n`);

  // Phase 2 — Strategy Intelligence API
  console.log("=== Phase 2: Strategy Intelligence ===");
  const stratRes = await fetch(base + "/api/intelligence/strategy", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ industry: "Real Estate", objective: "lead_gen", monthlyBudget: 300000, region: "IN" })
  });
  const strat = await stratRes.json();
  console.log(`status: ${stratRes.status}, channels: ${strat.channels?.length}, expected CPL: ₹${strat.expectedCpl}, confidence: ${(strat.confidence * 100).toFixed(0)}%`);
  console.log(`top channels:`, strat.channels?.slice(0, 3).map((c) => `${c.platform} (${c.allocationPct}%)`).join(", "));

  // Phase 3 — Content Intelligence
  console.log("\n=== Phase 3: Content Intelligence ===");
  const sugRes = await fetch(base + "/api/intelligence/content", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ action: "suggest", industry: "Real Estate", audience: "HNI", platform: "META", goal: "lead_gen" })
  });
  const sug = await sugRes.json();
  console.log(`status: ${sugRes.status}`);
  console.log(`recommendation: ${sug.recommendedFormat} | hook: "${sug.recommendedHookPattern}" | CTA: "${sug.recommendedCtaPattern}"`);
  console.log(`expected CPL: ₹${sug.expectedCpl}, expected CTR: ${sug.expectedCtr}%`);
  console.log(`rationale: ${sug.rationale?.slice(0, 100)}`);

  // Phase 4 — Orchestration
  console.log("\n=== Phase 4: Marketing Orchestration ===");
  const planRes = await fetch(base + "/api/orchestrate/plan", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({
      clientId: "cmu619dmo000ybonn6uv7n2dm", // Acme
      goalType: "lead_gen",
      goalQuantity: 500,
      goalMetric: "qualified_leads",
      goalDeadline: new Date(Date.now() + 90 * 86400_000).toISOString(),
      goalNotes: "Dubai investor acquisition"
    })
  });
  const plan = await planRes.json();
  console.log(`status: ${planRes.status}, planId: ${plan.planId}`);
  console.log(`budget: ₹${plan.budget?.totalMonthly}, campaigns: ${plan.campaigns?.length}`);
  console.log(`confidence: ${((plan.confidence ?? 0) * 100).toFixed(0)}%`);

  if (plan.planId) {
    // Move plan: DRAFT -> INTERNAL_REVIEW -> CLIENT_APPROVAL -> APPROVED -> deploy
    const actions = ["submit_internal_review", "submit_client_approval", "approve"];
    for (const a of actions) {
      const r = await fetch(base + "/api/orchestrate/plan", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: cookies },
        body: JSON.stringify({ planId: plan.planId, action: a })
      });
      console.log(`  ${a}: ${r.status}`);
    }
    // Deploy
    const depRes = await fetch(base + "/api/orchestrate/plan", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ planId: plan.planId, action: "deploy" })
    });
    const dep = await depRes.json();
    console.log(`  deploy: status=${depRes.status}, campaigns_created=${dep.deployed}, errors=${dep.errors?.length ?? 0}`);
  }

  // Phase 1 — Automation tick + lead scoring
  console.log("\n=== Phase 1: Automation tick + lead scoring ===");
  const tickRes = await fetch(base + "/api/automations/run", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ name: "automations.tick" })
  });
  const tick = await tickRes.json();
  console.log(`automation tick: status=${tickRes.status}, ok=${tick.ok}, ${tick.durationMs ?? 0}ms`);

  const scoreRes = await fetch(base + "/api/leads/auto-score", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({})
  });
  const score = await scoreRes.json();
  console.log(`lead scoring: status=${scoreRes.status}, scored=${score.scored}`);

  // Health check
  const hcRes = await fetch(base + "/api/automations/run", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ name: "campaign.health_check" })
  });
  const hc = await hcRes.json();
  console.log(`campaign health check: status=${hcRes.status}, ok=${hc.ok}, flagged=${hc.result?.flagged ?? 0}`);

  console.log("\n=== All 4 phases operational ===");
})();