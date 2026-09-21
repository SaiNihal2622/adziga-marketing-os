// Manually type OTP digit-by-digit using keyboard
import puppeteer from "puppeteer-core";

const otp = process.argv[2] || "971048";
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://accounts.razorpay.com/merchants/?redirecturl=https%3A%2F%2Feasy.razorpay.com&auth_intent=signup&x-country-code=IN", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3000));

// Focus the first OTP input
await page.click('input[name="otp"]');
await new Promise(r => setTimeout(r, 300));

// Type the OTP character by character
for (const ch of otp) {
  await page.keyboard.press(ch);
  await new Promise(r => setTimeout(r, 200));
}
await new Promise(r => setTimeout(r, 1500));

const state = await page.evaluate(() => ({
  inputs: Array.from(document.querySelectorAll('input[name="otp"]')).map(i => i.value),
  url: location.href
}));
console.log("Inputs filled:", JSON.stringify(state));

// Click Verify
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Verify');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 8000));

const after = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.slice(0, 2000)
}));
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: "scripts/.razorpay-after-otp2.png", fullPage: true });
await browser.disconnect();
