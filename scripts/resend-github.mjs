// Resend signup via GitHub OAuth
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/signup", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 1500));

// Click GitHub signup
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Log in with GitHub');
  if (btn) btn.click();
});

await new Promise(r => setTimeout(r, 5000));
console.log("URL after GitHub click:", page.url());

// If GitHub OAuth shown, authorize
if (page.url().includes("github.com")) {
  console.log("On GitHub OAuth, looking for Authorize button...");
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, input[type=submit]')).find(b => /authorize/i.test(b.textContent) || /authorize/i.test(b.value));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));
  console.log("URL after Authorize:", page.url());
}

// Check if we're now in Resend dashboard
await new Promise(r => setTimeout(r, 3000));
const state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  bodyText: document.body.innerText.slice(0, 2000)
}));
console.log(JSON.stringify(state, null, 2));
await page.screenshot({ path: "scripts/.resend-after-auth.png", fullPage: false });
await browser.disconnect();
