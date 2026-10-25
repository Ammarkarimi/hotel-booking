// Takes the landing-page screenshots (public/welcome/*.webp) from the running demo app.
// Requirements as for record-tour.mjs, plus Python with Pillow for the WebP conversion
// (or convert the PNGs any other way).
//   node scripts/tour/capture-screens.mjs http://localhost:3000
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const out = fs.mkdtempSync(path.join(os.tmpdir(), "hotel-screens-"));

const browser = await chromium.launch();

async function signedIn(width, height, scale) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const res = await ctx.request.post(base + "/api/auth/login", { data: { email: "admin@hotel.com", password: "admin123" } });
  if (!res.ok()) throw new Error("login failed " + res.status());
  return ctx;
}

const ctx = await signedIn(1280, 800, 1.5);
const page = await ctx.newPage();
const shot = async (name, url, opts = {}) => {
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (opts.before) await opts.before(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false, clip: opts.clip });
  console.log("saved", name);
};
const bookings = await page.request.get(base + "/api/bookings?view=in_house").then((r) => r.json());
const withExtras = bookings.find((b) => b.charges.length > 0) || bookings[0];
const left = await page.request.get(base + "/api/bookings?view=past").then((r) => r.json());
const invoiceBooking = left.find((b) => b.status === "checked_out" && b.charges.length > 0) || left[0];

await shot("today", "/");
await shot("calendar", "/calendar");
await shot("booking", `/bookings/${withExtras.id}`);
await shot("new-booking", "/bookings/new", {
  before: async (p) => {
    await p.getByRole("button", { name: "2 nights" }).click();
    await p.getByRole("button", { name: /Next: choose a room/ }).click();
    await p.getByText("total incl. tax").first().waitFor();
    await p.waitForTimeout(400);
  },
});
await shot("housekeeping", "/housekeeping");
await shot("reports", "/reports", { before: async (p) => { await p.getByText("Rooms sold each night").waitFor(); await p.waitForTimeout(800); } });
await shot("invoice", `/print/invoice/${invoiceBooking.id}`, { before: async (p) => p.evaluate(() => window.scrollTo(0, 40)) });
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

// Convert to WebP for the page (1600px wide screenshots, phone shot as is, 16:9 poster).
execFileSync("python3", ["-c", `
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for name in ["today", "calendar", "booking", "new-booking", "housekeeping", "reports", "invoice"]:
    im = Image.open(f"{src}/{name}.png").convert("RGB")
    im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS).save(f"{dst}/{name}.webp", "WEBP", quality=82, method=6)
Image.open(f"{src}/guest-site.png").convert("RGB").save(f"{dst}/guest-site.webp", "WEBP", quality=82, method=6)
poster = Image.open(f"{src}/today.png").convert("RGB").crop((0, 0, 1920, 1080)).resize((1280, 720), Image.LANCZOS)
poster.save(f"{dst}/tour-poster.webp", "WEBP", quality=82, method=6)
poster.save(f"{dst}/og-image.jpg", "JPEG", quality=85)
`, out, path.resolve("public/welcome")], { stdio: "inherit" });
fs.rmSync(out, { recursive: true, force: true });
console.log("Saved screenshots to public/welcome/");
