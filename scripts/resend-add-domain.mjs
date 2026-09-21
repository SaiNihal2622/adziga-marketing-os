// Add adziga.in to Resend domains
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/domains/add", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3000));

// Fill domain name
await page.evaluate(() => {
  const setNativeValue = (el, val) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const inp = document.querySelector('input[placeholder*="example.com"]');
  if (inp) setNativeValue(inp, 'adziga.in');
});
await new Promise(r => setTimeout(r, 800));

// Click "Add domain"
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null)
    .find(b => b.textContent.trim() === 'Add domain');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 6000));

const result = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 3500)
}));
console.log("After Add domain click:");
console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: "scripts/.resend-domain-add.png", fullPage: true });
await browser.disconnect();
