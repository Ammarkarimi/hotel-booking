// Records the landing-page video tour from the running app.
//
// Before running (see docs/technical.md, "Landing page video"):
//   1. A fresh demo database:  npm run db:setup:dev   (on an empty database)
//   2. The app running:        npm run build && npm start
//   3. Playwright + ffmpeg:    npm i --no-save playwright && npx playwright install chromium
//
// Then:  node scripts/tour/record-tour.mjs http://localhost:3000
// It writes public/welcome/hotel-manager-tour.mp4 and .webm and prints the chapter
// times to paste into CHAPTERS in src/app/welcome/tour.tsx.
// The demo hotel's data is changed by the recording, so re-seed before recording again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "hotel-tour-"));
const publicDir = path.resolve("public/welcome");
fs.mkdirSync(`${outDir}/frames`, { recursive: true });

const OVERLAY = `
(() => {
  if (window.top !== window) return;
  const css = \`
    #demo-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
      transition: left .65s cubic-bezier(.45,.05,.25,1), top .65s cubic-bezier(.45,.05,.25,1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #demo-ripple { position: fixed; z-index: 2147483646; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(37,72,235,.35); pointer-events: none; transform: scale(.2); opacity: 0; }
    #demo-ripple.on { animation: demo-ripple .55s ease-out; }
    @keyframes demo-ripple { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }
    #demo-caption { position: fixed; z-index: 2147483645; left: 50%; top: 10px; transform: translateX(-50%); width: min(860px, calc(100% - 48px));
      background: rgba(15,23,42,.94); color: #fff; border-radius: 16px; padding: 14px 20px; display: flex; gap: 16px; align-items: center;
      font-family: Inter, system-ui, sans-serif; box-shadow: 0 12px 40px rgba(15,23,42,.35); pointer-events: none; transition: opacity .3s; }
    #demo-caption[hidden] { display: none !important; }
    #demo-caption .n { flex: none; background: #2548eb; color: #fff; font-weight: 800; font-size: 15px; border-radius: 999px; padding: 6px 12px; }
    #demo-caption .t { font-weight: 800; font-size: 20px; line-height: 1.2; }
    #demo-caption .s { font-size: 15px; color: #cbd5e1; margin-top: 3px; line-height: 1.35; }
    #demo-card { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; text-align: center; color: #fff;
      background: linear-gradient(135deg, #1d37d8, #2548eb 45%, #1e2d8a); font-family: Inter, system-ui, sans-serif; transition: opacity .6s; }
    #demo-card[hidden] { display: none !important; }
    #demo-card .k { letter-spacing: .14em; text-transform: uppercase; font-size: 15px; font-weight: 700; opacity: .8; }
    #demo-card .h { font-size: 56px; font-weight: 800; margin: 10px 0 8px; letter-spacing: -.02em; }
    #demo-card .p { font-size: 22px; opacity: .92; max-width: 760px; }
  \`;
  function mount() {
    if (document.getElementById('demo-cursor')) return;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 10.5-6.6 1.3 3.9 7.4-3 1.6-3.9-7.5L4 20z" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const ripple = document.createElement('div'); ripple.id = 'demo-ripple';
    const cap = document.createElement('div'); cap.id = 'demo-caption'; cap.hidden = true;
    cap.innerHTML = '<span class="n"></span><div><div class="t"></div><div class="s"></div></div>';
    const card = document.createElement('div'); card.id = 'demo-card'; card.hidden = true;
    card.innerHTML = '<div><div class="k"></div><div class="h"></div><div class="p"></div></div>';
    document.body.append(cur, ripple, cap, card);
    const saved = JSON.parse(sessionStorage.getItem('demo-state') || '{}');
    cur.style.transition = 'none';
    cur.style.left = (saved.x ?? 640) + 'px'; cur.style.top = (saved.y ?? 400) + 'px';
    requestAnimationFrame(() => { cur.style.transition = ''; });
    if (saved.caption) window.__demo.caption(...saved.caption, true);
  }
  function save(patch) {
    const s = JSON.parse(sessionStorage.getItem('demo-state') || '{}');
    sessionStorage.setItem('demo-state', JSON.stringify({ ...s, ...patch }));
  }
  window.__demo = {
    move(x, y) { const c = document.getElementById('demo-cursor'); if (!c) return; c.style.left = x + 'px'; c.style.top = y + 'px'; save({ x, y }); },
    ripple() { const c = document.getElementById('demo-cursor'); const r = document.getElementById('demo-ripple'); if (!c || !r) return;
      r.style.left = (parseFloat(c.style.left) + 4) + 'px'; r.style.top = (parseFloat(c.style.top) + 3) + 'px';
      r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); },
    caption(n, t, s, restoring) { const cap = document.getElementById('demo-caption'); if (!cap) return;
      if (n === null) { cap.hidden = true; save({ caption: null }); return; }
      cap.querySelector('.n').textContent = n; cap.querySelector('.t').textContent = t; cap.querySelector('.s').textContent = s || '';
      cap.hidden = false; if (!restoring) save({ caption: [n, t, s] }); },
    card(k, h, p) { const c = document.getElementById('demo-card'); if (!c) return;
      if (k === null) { c.style.opacity = '0'; setTimeout(() => { c.hidden = true; c.style.opacity = ''; }, 600); return; }
      c.querySelector('.k').textContent = k; c.querySelector('.h').textContent = h; c.querySelector('.p').textContent = p; c.hidden = false; },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(OVERLAY);
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  const i = frames.length;
  fs.writeFileSync(`${outDir}/frames/${String(i).padStart(6, "0")}.jpg`, Buffer.from(f.data, "base64"));
  frames.push(f.metadata.timestamp);
  try {
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
  } catch {}
});
await page.goto("about:blank");
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const t0 = Date.now() / 1000;

const chapters = [];
const wait = (ms) => page.waitForTimeout(ms);
async function caption(n, title, sub) {
  chapters.push({ n, title, sub, at: Date.now() / 1000 });
  await page.evaluate(([n, t, s]) => window.__demo.caption(String(n), t, s), [n, title, sub]);
  await wait(1600);
}
async function point(locator, pause = 650) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(([x, y]) => window.__demo.move(x, y), [box.x + Math.min(box.width / 2, 60), box.y + box.height / 2]);
  await wait(pause);
}
async function click(locator, after = 700) {
  await point(locator);
  await page.evaluate(() => window.__demo.ripple());
  await wait(150);
  await locator.click();
  await wait(after);
}
async function type(locator, text) {
  await click(locator, 200);
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 55 });
  await wait(300);
}
async function scrollTo(y, ms = 1100) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
  await wait(ms);
}
const addDays = (key, n) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------------- Intro + 1. Guest books online ----------------
await page.goto(base + "/book/sunrise-residency", { waitUntil: "networkidle" });
await page.evaluate(() => window.__demo.card("A 3-minute tour", "Hotel Manager", "Simple hotel software for small hotels, guest houses and homestays."));
await wait(3200);
await page.evaluate(() => window.__demo.card(null));
await wait(700);
await caption(1, "Guests book on your own website", "Every hotel gets a booking page with live prices. Guests book directly, so there's no commission to pay.");
const arrival = await page.getByLabel("Arrival").inputValue();
await click(page.getByLabel("Departure"), 300);
await page.getByLabel("Departure").fill(addDays(arrival, 2));
await wait(500);
await click(page.getByRole("button", { name: "Check prices" }), 1200);
await page.getByText("Available rooms").waitFor();
await scrollTo(380, 1400);
let roomButton = page.getByRole("heading", { name: "Deluxe room" }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").getByRole("button", { name: "Book this room" });
if (!(await roomButton.count())) roomButton = page.getByRole("button", { name: "Book this room" }).first();
await click(roomButton, 900);
await type(page.getByLabel("First name"), "Kavya");
await type(page.getByLabel("Last name"), "Rao");
await type(page.getByLabel("Mobile number"), "+91 98450 22110");
await type(page.getByLabel("Special requests"), "Arriving around 4 pm");
await click(page.locator("input[type=checkbox]"), 300);
await click(page.getByRole("button", { name: /Confirm booking/ }), 600);
await page.waitForURL(/\/book\/confirmation\//);
await page.getByText("Your booking is confirmed!").waitFor();
await wait(3000);

// ---------------- 2. Today screen ----------------
const login = await ctx.request.post(base + "/api/auth/login", { data: { email: "admin@hotel.com", password: "admin123" } });
if (!login.ok()) throw new Error("login failed");
await page.goto(base + "/", { waitUntil: "networkidle" });
await caption(2, "Your whole day on one screen", "Who is arriving, who is leaving, which rooms are free and how much money came in today.");
await point(page.getByText(/Arriving today/).first(), 1200);
await point(page.getByText("Kavya Rao").first(), 1400);
await point(page.getByText(/Leaving today/).first(), 1200);
await point(page.getByText("Money received today"), 1200);
await scrollTo(760, 1600);
await point(page.getByText("All rooms right now"), 1800);
await scrollTo(0, 1000);

// ---------------- 3. Walk-in guest ----------------
await caption(3, "A walk-in guest in under a minute", "Choose the nights, pick a free room, type the guest's name and phone. Done.");
await click(page.getByRole("button", { name: "Walk-in guest" }), 1200);
await click(page.getByRole("button", { name: "2 nights" }), 600);
await click(page.getByRole("button", { name: /Next: choose a room/ }), 1000);
const firstRoom = page.locator("button", { hasText: "total incl. tax" }).first();
await firstRoom.waitFor();
await wait(600);
await click(firstRoom, 700);
await click(page.getByRole("button", { name: /Next: guest details/ }), 900);
await type(page.getByLabel("First name"), "Rahul");
await type(page.getByLabel("Last name"), "Verma");
await type(page.getByLabel("Mobile number"), "98765 12345");
await type(page.getByPlaceholder("ID number"), "XXXX XXXX 5521");
await click(page.getByRole("button", { name: /Next: price/ }), 900);
await type(page.getByLabel(/Advance payment/), "2000");
await click(page.getByRole("button", { name: "UPI / QR", exact: true }), 600);
await click(page.getByRole("button", { name: /Book & check in now/ }), 800);
await page.getByText("Guest checked in!").waitFor();
await wait(800);
await point(page.getByRole("button", { name: /Send on WhatsApp/ }), 2400);

// ---------------- 4. Room calendar ----------------
await caption(4, "See every room at a glance", "Coloured bars are guests. Tap an empty box to book that room for that day.");
await click(page.getByRole("link", { name: /Room Calendar/ }), 1500);
await page.locator("button[title^='#']").first().waitFor();
const bars = page.locator("button[title^='#']");
await point(bars.nth(2), 1100);
await point(bars.nth(5), 1100);
await point(page.locator("button[title^='Book room']").nth(30), 1600);

// ---------------- 5. Check in ----------------
await caption(5, "Check in with one tap", "You're reminded if the room isn't clean yet or the guest's ID proof is missing.");
await click(page.getByRole("link", { name: /^Today/ }), 1500);
const kavyaRow = page.locator("div", { has: page.getByText("Kavya Rao", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Check in" }) }).last();
await click(kavyaRow.getByRole("button", { name: "Check in" }), 1300);
await click(page.getByRole("button", { name: "Yes, check in" }), 600);
await page.getByText(/Guest checked in/).first().waitFor();
await wait(1600);

// ---------------- 6. Extras ----------------
await caption(6, "Add food, laundry and extras", "Everything the guest orders goes on one bill, with the right tax added.");
await click(page.getByRole("link", { name: /Kavya Rao/ }).first(), 1500);
await page.getByRole("heading", { name: /Booking #/ }).waitFor();
await click(page.getByRole("button", { name: "Add item" }), 900);
await click(page.getByRole("button", { name: "Food & drinks" }), 400);
await type(page.getByLabel(/Description/), "Dinner, 2 thalis");
await type(page.getByLabel("Quantity"), "2");
await type(page.getByLabel("Price each"), "280");
await click(page.getByRole("button", { name: "Add to bill" }), 600);
await page.getByText("Added to the guest's bill").waitFor();
await wait(600);
await point(page.getByText("Dinner, 2 thalis").first(), 1400);
await point(page.getByText(/Still to pay|Fully paid/).first(), 1800);

// ---------------- 7. Check out & payment ----------------
await caption(7, "Check out and take payment", "The bill is ready. Take cash, UPI or card, and the room is marked for cleaning.");
await click(page.getByRole("link", { name: /^Today/ }), 1500);
await click(page.getByRole("button", { name: "Check out" }).first(), 1200);
await page.getByText("Total bill (incl. tax)").waitFor();
await wait(1400);
await click(page.getByRole("dialog").getByRole("button", { name: "UPI / QR", exact: true }), 700);
await click(page.getByRole("button", { name: /& check out/ }), 700);
await page.getByText(/Guest checked out/).first().waitFor();
await wait(1800);

// ---------------- 8. GST invoice ----------------
await caption(8, "A GST invoice in one tap", "Hotel and guest GSTIN, CGST and SGST, SAC codes and the amount in words. Print it or save it as a PDF.");
const lastOut = await page.evaluate(async () => {
  const r = await (await fetch("/api/bookings?view=past")).json();
  r.sort((a, b) => String(b.actualCheckOut || "").localeCompare(String(a.actualCheckOut || "")));
  return r[0].id;
});
await page.goto(base + `/print/invoice/${lastOut}`, { waitUntil: "networkidle" });
await wait(1800);
await scrollTo(260, 2000);
await scrollTo(560, 2200);

// ---------------- 9. Housekeeping ----------------
await page.goto(base + "/housekeeping", { waitUntil: "networkidle" });
await caption(9, "Housekeeping from any phone", "Rooms turn “Needs cleaning” when a guest leaves. Staff mark them clean when they're done.");
await click(page.getByRole("button", { name: "Start cleaning" }).first(), 900);
await type(page.getByLabel(/Who is cleaning/), "Lakshmi");
await click(page.getByRole("dialog").getByRole("button", { name: "Start cleaning" }), 1200);
const cleaningCard = page.locator("div", { has: page.getByText("Lakshmi") }).filter({ has: page.getByRole("button", { name: "Mark clean" }) }).last();
await click(cleaningCard.getByRole("button", { name: "Mark clean" }), 1800);

// ---------------- 10. Payments ----------------
await page.goto(base + "/payments", { waitUntil: "networkidle" });
await caption(10, "Count the cash drawer in seconds", "Today's money by cash, UPI and card, with every payment and who received it.");
await point(page.getByText("Total received"), 1200);
await point(page.getByText("Cash", { exact: true }).first(), 1200);
await point(page.getByText("UPI / QR", { exact: true }).first(), 1600);

// ---------------- 11. Reports ----------------
await page.goto(base + "/reports", { waitUntil: "networkidle" });
await page.getByText("Rooms sold each night").waitFor();
await caption(11, "Reports for the owner", "How full the hotel was, what you earned, who still owes money, and your GST summary.");
await point(page.getByText("How full (occupancy)"), 1400);
await scrollTo(520, 1800);
await scrollTo(1100, 1800);
await scrollTo(1700, 2000);

// ---------------- 12. Settings ----------------
await page.goto(base + "/settings?tab=prices", { waitUntil: "networkidle" });
await caption(12, "Your prices, GST and staff", "Weekend and festival prices, automatic GST slabs, and a separate sign-in for every staff member.");
await point(page.getByText("Indian GST slabs (automatic)"), 1400);
await scrollTo(520, 1600);
await click(page.getByRole("button", { name: "Staff", exact: true }), 1400);
await scrollTo(0, 800);
await wait(1400);

// ---------------- End card ----------------
await page.evaluate(() => window.__demo.caption(null));
chapters.push({ n: "end", title: "End", at: Date.now() / 1000 });
await page.evaluate(() => window.__demo.card("Hotel Manager", "Easy enough for any front desk", "Bookings, check-in, GST bills, housekeeping and reports, from a phone or computer."));
await wait(4000);

await cdp.send("Page.stopScreencast");
await wait(300);
await browser.close();

// ---------------- Encode ----------------
const first = frames[0];
const introAt = chapters[0].at - first - 3.95; // the title card shows ~3.9s before chapter 1
const start = Math.max(0, introAt);
const lines = [];
frames.forEach((ts, i) => {
  const rel = ts - first;
  const next = i + 1 < frames.length ? frames[i + 1] - first : rel + 2;
  if (next <= start) return;
  lines.push(`file '${outDir}/frames/${String(i).padStart(6, "0")}.jpg'`, `duration ${Math.max(next - Math.max(rel, start), 0.001).toFixed(4)}`);
});
lines.push(`file '${outDir}/frames/${String(frames.length - 1).padStart(6, "0")}.jpg'`);
fs.writeFileSync(`${outDir}/list.txt`, lines.join("\n") + "\n");
const input = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${outDir}/list.txt`, "-vf", "fps=30,format=yuv420p", "-an"];
execFileSync("ffmpeg", [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", `${publicDir}/hotel-manager-tour.mp4`], { stdio: "inherit" });
execFileSync("ffmpeg", [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${publicDir}/hotel-manager-tour.webm`], { stdio: "inherit" });
fs.rmSync(outDir, { recursive: true, force: true });

const times = chapters.filter((c) => c.n !== "end").map((c) => ({ t: Math.round((c.at - first - start) * 10) / 10, title: c.title }));
times[0].t = 0;
console.log(`Saved public/welcome/hotel-manager-tour.mp4 and .webm (${(frames.at(-1) - first - start).toFixed(0)}s).`);
console.log("Paste these into CHAPTERS in src/app/welcome/tour.tsx:");
for (const c of times) console.log(`  { t: ${c.t}, title: ${JSON.stringify(c.title)} },`);
