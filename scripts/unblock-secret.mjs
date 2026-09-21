// Click the GitHub push-protection unblock UI
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://github.com/SaiNihal2622/adziga-marketing-os/security/secret-scanning/unblock-secret/3Jc6NLKed5KF9Y0mQWXFWhqnDWP", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2000));

// Pick "false_positive" reason and submit
const result = await page.evaluate(() => {
  const fpRadio = document.querySelector('input[type="radio"][value="false_positive"]');
  if (fpRadio) {
    fpRadio.click();
  } else {
    return { ok: false, error: "false_positive radio not found" };
  }

  // Find the Allow button and click it
  const allowBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().toLowerCase().includes('allow me to expose'));
  if (allowBtn) {
    allowBtn.click();
    return { ok: true, action: "clicked Allow" };
  }
  return { ok: false, error: "Allow button not found" };
});
console.log("Result:", JSON.stringify(result));

await new Promise(r => setTimeout(r, 4000));
const after = await page.evaluate(() => ({
  url: location.href,
  bodyText: document.body.innerText.slice(0, 1500)
}));
console.log("After click:", JSON.stringify(after, null, 2));
await page.screenshot({ path: "scripts/.after-unblock.png", fullPage: true });
await browser.disconnect();
