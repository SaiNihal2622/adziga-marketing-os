// Get FULL DNS record values from Resend domain detail page
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/domains/207cbdbd-1382-4388-bcce-32b0d02cb797", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 4000));

// Find ALL input fields - Resend often has the full value in an <input readonly>
const result = await page.evaluate(() => {
  // Find each record row, extract full values from inputs or code elements
  const rows = Array.from(document.querySelectorAll('tr')).map(tr => {
    const inputs = Array.from(tr.querySelectorAll('input')).map(i => i.value).filter(Boolean);
    const codeTexts = Array.from(tr.querySelectorAll('code, pre, [class*=code], [class*=mono]')).map(c => c.textContent.trim());
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim().slice(0, 100));
    return { inputs, codeTexts, cells };
  });
  return rows.filter(r => r.cells.length >= 2 || r.inputs.length > 0);
});

console.log("Rows with values:");
console.log(JSON.stringify(result, null, 2));

// Also try clicking any "copy" buttons to expose full value
await page.evaluate(() => {
  document.querySelectorAll('button').forEach(btn => {
    if (/copy/i.test(btn.textContent)) {
      try { btn.click(); } catch (e) {}
    }
  });
});
await new Promise(r => setTimeout(r, 1500));

const clipboardText = await page.evaluate(async () => {
  try {
    return await navigator.clipboard.readText();
  } catch (e) {
    return null;
  }
});
console.log("Clipboard:", clipboardText);

// Try innerText extraction with full content
const fullText = await page.evaluate(() => {
  // Try to find each record's full content
  const records = [];
  document.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 3) {
      const name = tds[0].textContent.trim();
      const type = tds[1].textContent.trim();
      // The 3rd td should have the value, but it might be truncated
      const valueCell = tds[2];
      const input = valueCell.querySelector('input');
      const value = input ? input.value : valueCell.textContent.trim();
      records.push({ name, type, value });
    }
  });
  return records;
});

console.log("\nFull records:");
console.log(JSON.stringify(fullText, null, 2));

await page.screenshot({ path: "scripts/.resend-records.png", fullPage: true });
await browser.disconnect();
