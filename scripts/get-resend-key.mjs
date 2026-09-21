// Full Resend API key creation flow
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
if (!page) page = await browser.newPage();

await page.goto("https://resend.com/api-keys", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3500));

// Click Create API key
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create API key');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 3000));

// Fill name using React-compatible value setter
await page.evaluate(() => {
  const setNativeValue = (el, val) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const nameInput = document.querySelector('input[name=name]');
  if (nameInput) setNativeValue(nameInput, 'Adziga Production');
});
await new Promise(r => setTimeout(r, 800));

// Click the "Add" button (modal primary action). Try multiple selectors.
const clicked = await page.evaluate(() => {
  // Try keyboard shortcut instead — Add button shows "Ctrl + Enter"
  const submitBtn = document.querySelector('form button[type=submit]');
  if (submitBtn) {
    submitBtn.click();
    return 'form submit clicked';
  }
  // Fallback: find by tabindex / data attribute
  const allEls = Array.from(document.querySelectorAll('button, [role=button], div[tabindex]'));
  const candidates = allEls.filter(el => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t === 'Add' || t.startsWith('Add ') || /^AddCtrl/.test(t);
  });
  if (candidates.length) {
    candidates[candidates.length - 1].click();
    return 'fallback clicked: ' + candidates.length;
  }
  return 'no candidate';
});
console.log("Clicked:", clicked);

// Wait for success modal with the key
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  // Check input values too — Resend often shows the key in an <input readonly>
  const inputValues = Array.from(document.querySelectorAll('input'))
    .map(i => i.value)
    .filter(v => v.startsWith('re_'));
  const textMatches = text.match(/re_[A-Za-z0-9_-]+/g) || [];
  const all = [...new Set([...inputValues, ...textMatches])];
  const sorted = all.sort((a, b) => b.length - a.length);
  return {
    longest: sorted[0],
    all: sorted,
    inputCount: inputValues.length,
    bodyText: text.slice(0, 2500)
  };
});

console.log("Longest re_*:", result.longest);
console.log("All candidates:", JSON.stringify(result.all));
console.log("Body:", result.bodyText);

await page.screenshot({ path: "scripts/.resend-after-create.png", fullPage: true });
await browser.disconnect();
