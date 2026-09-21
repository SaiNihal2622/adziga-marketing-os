// Single-flow Razorpay: signup → password → request new OTP → grab from Gmail → verify
import puppeteer from "puppeteer-core";
import https from "node:https";

const setVal = async (page, sel, val) => page.evaluate((s, v) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, sel, val);

const clickByText = async (page, text) => page.evaluate((t) => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().includes(t.toLowerCase()));
  if (btn) { btn.click(); return true; }
  return false;
}, text);

// Wait for a fresh OTP email to arrive by polling Gmail page text
const fetchLatestOtp = async (page) => {
  const m = await page.evaluate(() => {
    const txt = document.body.innerText;
    const matches = [...txt.matchAll(/verification code: (\d{6})/g)];
    return matches.length ? matches[matches.length - 1][1] : null;
  });
  return m;
};

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

// Open Razorpay signup
await page.goto("https://dashboard.razorpay.com/signup", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2500));

// Email
await setVal(page, 'input[name="input-unknown"]', 'sainihalboora@gmail.com');
await new Promise(r => setTimeout(r, 700));
await clickByText(page, "Continue");
await new Promise(r => setTimeout(r, 6000));

// Password
await setVal(page, 'input[name="password"]', 'AdzigaSecure#2026!');
await new Promise(r => setTimeout(r, 800));
await clickByText(page, "Login") || await clickByText(page, "Create Password") || await clickByText(page, "Continue");
await new Promise(r => setTimeout(r, 7000));

// Check if we're on OTP screen
let onOtp = await page.evaluate(() => document.querySelectorAll('input[name="otp"]').length > 0);
if (!onOtp) {
  console.log("Not on OTP screen yet. URL:", page.url());
  // Maybe need another action
  await clickByText(page, "Login");
  await new Promise(r => setTimeout(r, 5000));
  onOtp = await page.evaluate(() => document.querySelectorAll('input[name="otp"]').length > 0);
}

if (!onOtp) {
  console.log("FAILED to reach OTP screen");
  process.exit(1);
}
console.log("On OTP screen. Going to Gmail to fetch code...");

// Open Gmail in a new tab
const gmail = await browser.newPage();
await gmail.goto("https://mail.google.com/mail/u/0/#inbox", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 4000));

// Poll for fresh OTP (skip the one we already used)
let otp = null;
const usedOtps = new Set();
for (let attempt = 0; attempt < 30; attempt++) {
  const latest = await fetchLatestOtp(gmail);
  if (latest && !usedOtps.has(latest)) {
    otp = latest;
    usedOtps.add(latest);
    break;
  }
  await new Promise(r => setTimeout(r, 2000));
}
if (!otp) {
  console.log("No OTP found in Gmail");
  process.exit(1);
}
console.log("Got OTP from Gmail:", otp);

// Focus Razorpay OTP and type
await page.bringToFront();
// Fill only VISIBLE OTP inputs (skip the first hidden one)
await page.evaluate((code) => {
  const inputs = Array.from(document.querySelectorAll('input[name="otp"]'))
    .filter(i => i.offsetParent !== null); // skip hidden
  const setNativeValue = (el, val) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  inputs.forEach((inp, i) => setNativeValue(inp, code.charAt(i) || ''));
  if (inputs[0]) inputs[0].focus();
}, otp);
await new Promise(r => setTimeout(r, 1500));

const inputsState = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input[name="otp"]'));
  return inputs.map(i => ({ value: i.value, hidden: i.offsetParent === null }));
});
console.log("Inputs after fill:", JSON.stringify(inputsState));

// Verify
await clickByText(page, "Verify");
await new Promise(r => setTimeout(r, 12000));

const after = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 2000)
}));
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: "scripts/.razorpay-final.png", fullPage: true });
await browser.disconnect();
