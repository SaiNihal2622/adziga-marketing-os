// Adziga — Browser automation via CDP
// Usage: node scripts/browser.mjs <url> [snapshot|click|waitfor] [selectorOrJs]

import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "about:blank";
const action = process.argv[3] ?? "snapshot";
const selectorOrJs = process.argv[4];

async function main() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages[0];
  if (!page) page = await browser.newPage();

  // Always navigate (even on about:blank) so eval has the right page
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  // Wait an extra second for client-side hydration
  await new Promise(r => setTimeout(r, 1500));

  if (action === "snapshot") {
    const data = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 6000) ?? ""
    }));
    console.log(JSON.stringify(data, null, 2));
    await page.screenshot({ path: "scripts/.browser-snap.png", fullPage: false });
  } else if (action === "click") {
    await page.waitForSelector(selectorOrJs, { timeout: 15000 });
    await page.click(selectorOrJs);
    await new Promise(r => setTimeout(r, 2500));
    const data = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 6000) ?? ""
    }));
    console.log(JSON.stringify(data, null, 2));
    await page.screenshot({ path: "scripts/.browser-snap.png", fullPage: false });
  } else if (action === "waitfor") {
    await page.waitForSelector(selectorOrJs, { timeout: 15000 });
    const data = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 6000) ?? ""
    }));
    console.log(JSON.stringify(data, null, 2));
  } else if (action === "eval") {
    const result = await page.evaluate((code) => {
      try { return { ok: true, value: eval(code) }; }
      catch (e) { return { ok: false, error: String(e) }; }
    }, selectorOrJs);
    console.log(JSON.stringify(result, null, 2));
  } else if (action === "type") {
    await page.waitForSelector(selectorOrJs, { timeout: 15000 });
    await page.type(selectorOrJs, process.argv[5] ?? "");
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 3000));
    const data = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 6000) ?? ""
    }));
    console.log(JSON.stringify(data, null, 2));
  }

  await browser.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

