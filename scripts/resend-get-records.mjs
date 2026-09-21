// Get DNS records for adziga.in from Resend domain detail page
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/domains", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3500));

// Click on adziga.in link
const linkClicked = await page.evaluate(() => {
  const link = Array.from(document.querySelectorAll('a')).find(a => /adziga\.in/i.test(a.textContent) && a.href);
  if (link) {
    link.click();
    return link.href;
  }
  return null;
});
console.log("Clicked:", linkClicked);
await new Promise(r => setTimeout(r, 5000));

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  // Look for DNS record rows: Type, Name, Value, TTL
  const tableRows = Array.from(document.querySelectorAll('tr')).map(tr => {
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
    return cells;
  }).filter(row => row.length >= 2);
  return {
    url: location.href,
    tableRows,
    bodyText: text.slice(0, 3500),
    // Extract SPF/DKIM/DMARC records from text
    records: [
      ...(text.match(/[A-Z]+\s+resend\.com\s+\S+/g) || []),
      ...(text.match(/_dmarc\.\S+\s+\S+/g) || []),
      ...(text.match(/resend\._domainkey\.\S+\s+\S+/g) || [])
    ]
  };
});
console.log("URL:", result.url);
console.log("Table rows:", JSON.stringify(result.tableRows, null, 2));
console.log("Body text:", result.bodyText);
console.log("Records:", result.records);
await page.screenshot({ path: "scripts/.resend-domain-detail.png", fullPage: true });
await browser.disconnect();
