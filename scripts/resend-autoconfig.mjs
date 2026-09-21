// Auto-configure Resend domain via Vercel
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/domains/207cbdbd-1382-4388-bcce-32b0d02cb797", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3500));

// Click Auto configure
const clicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button, a')).find(b => /auto configure/i.test(b.textContent.trim()));
  if (btn) { btn.click(); return 'clicked'; }
  return 'not found';
});
console.log("Auto configure:", clicked);
await new Promise(r => setTimeout(r, 4000));

const state = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 3000),
  inputs: Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder, value: i.value })),
  buttons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => b.textContent.trim().slice(0, 40))
}));
console.log("State:", JSON.stringify(state, null, 2));
await page.screenshot({ path: "scripts/.resend-autoconfig.png", fullPage: true });
await browser.disconnect();
