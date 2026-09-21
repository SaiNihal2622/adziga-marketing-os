// Saree end-to-end test — direct DB read
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const ts = Date.now();
const email = `saree-e2e-${ts}@example.in`;

const signup = await (
  await fetch("https://adziga-marketing-os.vercel.app/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgName: `Saree India ${ts}`,
      name: "Saree Owner",
      email,
      password: "SareeDemo#2026",
    }),
  })
).json();
console.log("Signup:", signup);

const orgId = signup.orgId;
const agents = await p.agent.findMany({
  where: { orgId },
  select: { id: true, role: true, name: true },
});
console.log("Agents:", agents.map((a) => a.role).join(", "));
const strategy = agents.find((a) => a.role === "STRATEGY");

// Login
const csrfResp = await fetch("https://adziga-marketing-os.vercel.app/api/auth/csrf");
const csrfData = await csrfResp.json();
const csrfCookie = csrfResp.headers.get("set-cookie")?.split(";")[0];
const loginResp = await fetch(
  "https://adziga-marketing-os.vercel.app/api/auth/callback/credentials",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      email,
      password: "SareeDemo#2026",
      callbackUrl: "/app/overview",
      json: "true",
    }),
    redirect: "manual",
  }
);
const loginCookies = loginResp.headers.getSetCookie?.() ?? [];
const cookieHeader = loginCookies.map((c) => c.split(";")[0]).join("; ");

// Ask the agent
console.log("\nAsking Strategy Agent...");
const start = Date.now();
const askResp = await fetch("https://adziga-marketing-os.vercel.app/api/agents/threads", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader + "; " + csrfCookie },
  body: JSON.stringify({
    agentId: strategy.id,
    firstMessage:
      "I run Mysore Silks saree e-commerce brand. Monthly budget Rs 50,000. Plan the channel allocation and create the campaigns.",
  }),
});
const elapsed = Date.now() - start;
const result = await askResp.json();
console.log(`\nThread ${result.threadId} responded in ${elapsed}ms`);

// Read the assistant's reply directly from DB
const messages = await p.agentMessage.findMany({
  where: { threadId: result.threadId },
  orderBy: { createdAt: "asc" },
});
console.log(`\n${messages.length} messages in thread:`);
for (const m of messages) {
  console.log(`-- ${m.role} (${m.status ?? "complete"}) --`);
  if (m.content) console.log(m.content.slice(0, 1200));
  if (m.toolCalls) {
    console.log("Tool calls (raw):", m.toolCalls.slice(0, 800));
  }
  console.log("");
}

// Show actions taken
const actions = await p.agentAction.findMany({
  where: { threadId: result.threadId },
  orderBy: { createdAt: "asc" },
});
console.log(`\n${actions.length} actions taken by agent:`);
for (const a of actions) {
  console.log(` • ${a.type} → ${a.summary}`);
  console.log(`   status: ${a.status}, payload: ${a.payload?.slice(0, 200)}`);
}

await p.$disconnect();
