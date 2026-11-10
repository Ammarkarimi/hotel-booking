// Takes the landing-page screenshots (public/welcome/*.webp and og-image.jpg) from the running
// demo app. Each screenshot scrolls the feature it describes into view; nothing is blurred.
//
// Requirements as for record-tour.mjs (fresh demo database, production build, Playwright).
//   node scripts/tour/capture-screens.mjs http://localhost:3000
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const out = fs.mkdtempSync(path.join(os.tmpdir(), "innvela-screens-"));
const publicDir = path.resolve("public/welcome");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
const login = await ctx.request.post(base + "/api/auth/login", { data: { email: "admin@hotel.com", password: "admin123" } });
if (!login.ok()) throw new Error("login failed " + login.status());
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

/** The panel (white box) around a heading or label. */
const panel = (locator) => locator.locator("xpath=ancestor::div[contains(@class,'bg-white')][1]");

async function open(url) {
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const seen = page.getByPlaceholder("I have seen");
  if (await seen.isVisible().catch(() => false)) {
    await seen.fill("I have seen");
    await page.getByRole("button", { name: "Close" }).last().click();
    await page.waitForTimeout(300);
  }
}

/** Put the feature in view (scrollTo: page y, "center" or "top" on the first element) and save. */
async function shot(name, focus, { scrollTo = "center" } = {}) {
  const handles = [];
  for (const l of focus) handles.push(...(await l.elementHandles()));
  if (!handles.length) throw new Error(`${name}: the feature was not found on the page`);
  if (scrollTo === "center") await handles[0].evaluate((el) => el.scrollIntoView({ block: "center" }));
  // "top": just below the bar of buttons that stays at the top of the screen.
  else if (scrollTo === "top") await handles[0].evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60));
  else await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
}

const all = await page.request.get(base + "/api/bookings").then((r) => r.json());
const inHouse = all.filter((b) => b.status === "checked_in");
const withExtras = inHouse.find((b) => b.charges?.length > 0) || inHouse[0];
const left = all.filter((b) => b.status === "checked_out");
const invoiceBooking = left.find((b) => b.charges?.length > 0) || left[0];

// Dashboard: the room board.
await open("/");
await shot("dashboard", [panel(page.getByText(/^Arriving today/).first())], { scrollTo: "top" });

// New reservation: the free rooms with their full price.
await open("/bookings/new");
await page.getByRole("button", { name: "2 nights" }).click();
await page.getByRole("button", { name: /Next: choose a room/ }).click();
const roomGrid = page.locator("button", { hasText: "total incl. tax" }).first().locator("..");
await roomGrid.waitFor();
await shot("new-booking", [roomGrid]);

// Room calendar: the chart only.
await open("/calendar");
await page.locator("button[title^='#']").first().waitFor();
await shot("calendar", [panel(page.locator("button[title^='#']").first())], { scrollTo: 0 });

// Guest bill: the bill only.
await open(`/bookings/${withExtras.id}`);
await shot("booking", [panel(page.getByText(/^Running total|^Final invoice/).first())]);

// GST invoice: the hotel's header, the lines and the tax totals.
await open(`/print/invoice/${invoiceBooking.id}`);
const invoice = page.locator(".print-page");
await shot("invoice", [invoice.locator("> div").first(), invoice.locator("table").nth(1), invoice.getByText("Amount in words:").locator("..")], { scrollTo: 40 });

// Housekeeping: the Needs cleaning column.
await open("/housekeeping");
await shot("housekeeping", [page.getByRole("heading", { name: /Needs cleaning/ }).locator("..")], { scrollTo: 0 });

// Expenses: the totals by kind of cost.
await open("/expenses");
await page.getByText("By kind of cost").waitFor();
await shot("expenses", [panel(page.getByText("By kind of cost"))]);

// Reports: the profit summary.
await open("/reports");
await page.getByText(/^Profit · /).first().waitFor();
await page.waitForTimeout(500);
await shot("reports", [panel(page.getByText(/^Profit · /).first())]);
await ctx.close();

// The guest booking website on a phone.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pp = await phone.newPage();
await pp.goto(base + "/book/sunrise-residency", { waitUntil: "networkidle" });
await pp.getByRole("button", { name: "Check prices" }).click();
await pp.getByText("Available rooms").waitFor();
await pp.evaluate(() => document.getElementById("results")?.scrollIntoView());
await pp.waitForTimeout(800);
await pp.screenshot({ path: `${out}/guest-site.png` });
console.log("saved guest-site");
await browser.close();

// WebP for the page (1600px wide; the phone shot as it is) and the link preview image.
for (const name of ["dashboard", "new-booking", "calendar", "booking", "invoice", "housekeeping", "expenses", "reports"]) {
  await sharp(`${out}/${name}.png`).resize({ width: 1600 }).webp({ quality: 82, effort: 6 }).toFile(`${publicDir}/${name}.webp`);
}
await sharp(`${out}/guest-site.png`).webp({ quality: 82, effort: 6 }).toFile(`${publicDir}/guest-site.webp`);
await sharp(`${out}/dashboard.png`).extract({ left: 0, top: 0, width: 1920, height: 1080 }).resize(1280, 720).jpeg({ quality: 85 }).toFile(`${publicDir}/og-image.jpg`);
fs.rmSync(out, { recursive: true, force: true });
console.log("Saved screenshots to public/welcome/ (the video poster comes from record-tour.mjs)");
