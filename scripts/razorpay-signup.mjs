// Try Razorpay signup with email only (no phone OTP)
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://dashboard.razorpay.com/signup", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2000));

// Type email in the email/phone input
await page.evaluate(() => {
  const inp = document.querySelector('input[name="input-unknown"]');
  if (inp) {
    const setNativeValue = (el, val) => {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setNativeValue(inp, 'sainihalboora@gmail.com');
  }
});
await new Promise(r => setTimeout(r, 800));

// Click Continue
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button, [role=button]')).find(b => b.textContent.trim() === 'Continue' || b.textContent.trim() === 'CONTINUE');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 5000));

// Fill password (must meet complexity rules: 8+ chars, upper, lower, number, special)
await page.evaluate(() => {
  const inp = document.querySelector('input[name="password"]');
  if (inp) {
    const setNativeValue = (el, val) => {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setNativeValue(inp, 'AdzigaSecure#2026!');
  }
});
await new Promise(r => setTimeout(r, 1500));

// Click Create Password / Login
const clicked = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
  const candidates = buttons.filter(b => /^(login|create password|verify|continue)$/i.test(b.textContent.trim()));
  if (candidates.length) {
    candidates[candidates.length - 1].click();
    return candidates[candidates.length - 1].textContent.trim();
  }
  return null;
});
console.log("Clicked:", clicked);
await new Promise(r => setTimeout(r, 5000));

const result = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  bodyText: document.body.innerText.slice(0, 2000),
  inputs: Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder, value: i.value }))
}));
console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: "scripts/.razorpay-after-continue.png", fullPage: true });
await browser.disconnect();
