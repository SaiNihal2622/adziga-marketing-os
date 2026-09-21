// Complete Razorpay signup in one go: email -> password -> OTP -> dashboard
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

const setVal = (sel, val) => page.evaluate((s, v) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, sel, val);

const clickByText = (text) => page.evaluate((t) => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().includes(t.toLowerCase()));
  if (btn) { btn.click(); return true; }
  return false;
}, text);

await page.goto("https://dashboard.razorpay.com/signup", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2000));

// 1. Email
await setVal('input[name="input-unknown"]', 'sainihalboora@gmail.com');
await new Promise(r => setTimeout(r, 600));
await clickByText("Continue");
await new Promise(r => setTimeout(r, 5000));

// 2. Password (may be create or login)
await setVal('input[name="password"]', 'AdzigaSecure#2026!');
await new Promise(r => setTimeout(r, 800));
await clickByText("Login") || clickByText("Create Password") || clickByText("Continue");
await new Promise(r => setTimeout(r, 6000));

// After password, we may land on dashboard, OTP screen, or back to login
console.log("After password submit - URL:", page.url());
const screen = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 500),
  hasOtpInputs: document.querySelectorAll('input[name="otp"]').length,
  hasDashboard: document.body.innerText.includes('Dashboard') || location.hostname.includes('dashboard')
}));
console.log("Screen state:", JSON.stringify(screen));

// If OTP screen, enter it
const otp = process.argv[2];
if (screen.hasOtpInputs && otp) {
  console.log("Entering OTP:", otp);
  await page.evaluate((code) => {
    const inputs = Array.from(document.querySelectorAll('input[name="otp"]'));
    const setNativeValue = (el, val) => {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    inputs.forEach((inp, i) => setNativeValue(inp, code.charAt(i)));
  }, otp);
  await new Promise(r => setTimeout(r, 2000));
  await clickByText("Verify");
  await new Promise(r => setTimeout(r, 8000));
}

console.log("After Verify - URL:", page.url());
const after = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  body: document.body.innerText.slice(0, 2000)
}));
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: "scripts/.razorpay-after-otp.png", fullPage: true });
await browser.disconnect();
