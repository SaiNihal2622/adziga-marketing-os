// Click the "Create API key" button (not the avatar)
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://aistudio.google.com/api-keys", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 2500));

// Use XPath to target the button by exact text
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const create = buttons.find(b => b.textContent.trim() === "key Create API key" || b.textContent.trim() === "Create API key");
  if (create) {
    create.click();
    console.log("clicked Create API key");
  } else {
    console.log("not found");
  }
});

await new Promise(r => setTimeout(r, 3500));

const dialogInfo = await page.evaluate(() => {
  const dialogs = Array.from(document.querySelectorAll('[role=dialog], dialog, .mat-mdc-dialog-container, .cdk-overlay-pane, .ms-dialog-content'));
  const result = { dialogCount: dialogs.length, dialogs: [] };
  for (const d of dialogs) {
    if (d.offsetParent === null) continue;
    const inputs = Array.from(d.querySelectorAll('input, select, textarea, mat-select')).map(i => ({
      tag: i.tagName,
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      value: i.value,
      labelText: i.closest('mat-form-field')?.querySelector('mat-label')?.textContent?.trim()
    }));
    const buttons = Array.from(d.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 40));
    const options = Array.from(d.querySelectorAll('mat-option')).map(o => o.textContent.trim().slice(0, 40));
    const text = d.textContent.slice(0, 1000);
    result.dialogs.push({ inputs, buttons, options, text });
  }
  return result;
});
console.log(JSON.stringify(dialogInfo, null, 2));

await page.screenshot({ path: "scripts/.after-create-click.png", fullPage: false });
await browser.disconnect();
