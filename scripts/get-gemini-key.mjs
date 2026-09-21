// Create Gemini API key and extract the value
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://aistudio.google.com/api-keys", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2500));

// Open Create dialog
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const create = buttons.find(b => b.textContent.trim() === "key Create API key" || b.textContent.trim() === "Create API key");
  if (create) create.click();
});
await new Promise(r => setTimeout(r, 2500));

// Click "Create key" in the dialog (use exact text match)
const clicked = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const createBtn = buttons.find(b => b.textContent.trim() === "Create key");
  if (createBtn) {
    createBtn.click();
    return true;
  }
  return false;
});
console.log("Click Create key:", clicked);

// Wait for the API key to appear
await new Promise(r => setTimeout(r, 4000));

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  // Look for "AIza" prefix in the page (Gemini API key format)
  const match = text.match(/AIza[A-Za-z0-9_-]{30,}/);
  return {
    apiKey: match ? match[0] : null,
    bodyText: text.slice(0, 2000)
  };
});

console.log("API KEY:", result.apiKey);
console.log("Body:", result.bodyText);

await page.screenshot({ path: "scripts/.api-key.png", fullPage: false });
await browser.disconnect();
