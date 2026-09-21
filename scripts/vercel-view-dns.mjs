// Click View DNS configuration and inspect the page
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://vercel.com/nihals-projects-df4b4829/adziga-marketing-os/settings/domains", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3500));

const clicked = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('div')).filter(el => el.textContent.trim() === 'View DNS configuration');
  if (links.length >= 2) {
    links[1].click();
    return 'clicked apex';
  }
  return `found ${links.length}`;
});
console.log("Click:", clicked);
await new Promise(r => setTimeout(r, 5000));

const state = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 5000),
  inputs: Array.from(document.querySelectorAll('input,textarea')).map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder, value: i.value })),
  buttons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => b.textContent.trim().slice(0, 40))
}));
console.log(JSON.stringify(state, null, 2));
await page.screenshot({ path: "scripts/.vercel-dns-detail.png", fullPage: true });
await browser.disconnect();
