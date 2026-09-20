#!/usr/bin/env node
// Adziga — One-shot credential setup for the things only the human can do
// (Razorpay, Meta, Google Ads, WhatsApp Business). Run after the human has
// finished signup in their browser.
//
// Usage:
//   node scripts/setup-credentials.mjs <provider> <key> <secret>
//   node scripts/setup-credentials.mjs razorpay rzp_test_xxx xxx
//   node scripts/setup-credentials.mjs meta EAAxxx xxx
//
// Each provider accepts (key, secret) and sets Vercel production env vars
// plus prints the exact env-var names so you can verify.

import { spawnSync } from "node:child_process";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error("Set VERCEL_TOKEN env var first (e.g. export VERCEL_TOKEN=vcp_xxx)");
  process.exit(1);
}

const PROVIDERS = {
  razorpay: {
    label: "Razorpay (Indian payments)",
    envs: [
      ["RAZORPAY_KEY_ID", 0, "rzp_test_xxx or rzp_live_xxx"],
      ["RAZORPAY_KEY_SECRET", 1, "From Razorpay Dashboard → Settings → API Keys"],
      ["RAZORPAY_WEBHOOK_SECRET", 2, "From Razorpay Dashboard → Settings → Webhooks → Create webhook → secret"]
    ],
    dashboard: "https://dashboard.razorpay.com/app/keys",
    docs: "https://razorpay.com/docs/api/"
  },
  meta: {
    label: "Meta (Facebook) Conversions API",
    envs: [
      ["META_ACCESS_TOKEN", 0, "System-user token from Meta Business Suite → Settings → Business Settings → System Users"],
      ["META_APP_SECRET", 1, "From Meta for Developers → Your App → Settings → Basic → App Secret"],
      ["META_WEBHOOK_VERIFY_TOKEN", 2, "Any random string you pick; webhook verifier compares it on subscription"]
    ],
    dashboard: "https://developers.facebook.com/apps/",
    docs: "https://developers.facebook.com/docs/marketing-api/conversions-api/"
  },
  google: {
    label: "Google Ads API",
    envs: [
      ["GOOGLE_ADS_DEVELOPER_TOKEN", 0, "From Google Ads API Center → API access → Apply for token"],
      ["GOOGLE_ADS_CLIENT_ID", 1, "OAuth client ID from Google Cloud Console → APIs & Services → Credentials"],
      ["GOOGLE_ADS_CLIENT_SECRET", 2, "OAuth client secret"]
    ],
    dashboard: "https://ads.google.com/aw/apicenter",
    docs: "https://developers.google.com/google-ads/api/docs/first-call/overview"
  },
  whatsapp: {
    label: "WhatsApp Business API",
    envs: [
      ["WHATSAPP_API_TOKEN", 0, "From Meta Business Suite → WhatsApp → API Setup → Permanent token"],
      ["WHATSAPP_PHONE_NUMBER_ID", 1, "From WhatsApp Business API → Phone Numbers"],
      ["WHATSAPP_BUSINESS_ACCOUNT_ID", 2, "From WhatsApp Manager → Account tools → WhatsApp Business Account ID"]
    ],
    dashboard: "https://business.facebook.com/wa/manage/home/",
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
  }
};

function vercelEnvAdd(name, value, env = "production") {
  const r = spawnSync("vercel", ["env", "add", name, env, "--token", TOKEN], {
    input: value + "\n",
    encoding: "utf8",
    shell: true
  });
  return r.status === 0 || /Added/.test(r.stdout + r.stderr);
}

function vercelEnvRm(name, env = "production") {
  const r = spawnSync("vercel", ["env", "rm", name, env, "--yes", "--token", TOKEN], {
    encoding: "utf8",
    shell: true
  });
  return r.status === 0;
}

const provider = process.argv[2];
if (!provider || !PROVIDERS[provider]) {
  console.log("Adziga credential setup\n");
  console.log("Usage: node scripts/setup-credentials.mjs <provider> [key] [secret] [extra]");
  console.log("\nSupported providers:");
  for (const [k, v] of Object.entries(PROVIDERS)) {
    console.log(`  ${k.padEnd(10)} ${v.label}`);
  }
  console.log("\nExample:");
  console.log(`  node scripts/setup-credentials.mjs razorpay rzp_test_xxx xxx`);
  process.exit(0);
}

const p = PROVIDERS[provider];

// Interactive mode if no args
const args = process.argv.slice(3);
if (args.length < p.envs.length) {
  console.log(`\n${p.label}\n${p.dashboard}\n${p.docs}\n`);
  for (const [name, idx, desc] of p.envs) {
    console.log(`  ${name}: ${desc}`);
  }
  console.log(`\nProvide all ${p.envs.length} values as args:`);
  console.log(`  node scripts/setup-credentials.mjs ${provider} <val0> <val1> <val2>`);
  process.exit(0);
}

let allOk = true;
for (const [name, idx] of p.envs) {
  const value = args[idx];
  if (!value) {
    console.log(`  ✗ ${name}: missing`);
    allOk = false;
    continue;
  }
  // Remove first to avoid duplicate error
  vercelEnvRm(name);
  const ok = vercelEnvAdd(name, value);
  console.log(`  ${ok ? "✓" : "✗"} ${name} = ${value.slice(0, 8)}...`);
  if (!ok) allOk = false;
}

console.log(`\n${allOk ? "✅ All set. Redeploy with: vercel deploy --prod --yes" : "❌ Some env vars failed. Check Vercel CLI."}`);
