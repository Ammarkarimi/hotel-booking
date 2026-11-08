// Records the landing-page video tour from the running app.
//
// It shows only a few highlights. On every screen the part being explained stays sharp and
// everything else (including the menu with every section) is blurred, so the video sells the
// software without handing out the whole of it.
//
// Before running (see docs/technical.md, "Landing page and video tour"):
//   1. A fresh demo database:  npm run db:setup:dev   (on an empty database)
//   2. The app running:        npm run build && npm start
//      (a production build: the offline copy shown in the tour only runs there)
//   3. Playwright + ffmpeg:    npm i --no-save playwright && npx playwright install chromium
//      ffmpeg on the PATH, or FFMPEG=<path to ffmpeg>
//
// Then:  node scripts/tour/record-tour.mjs http://localhost:3000
// It writes public/welcome/innvela-tour.mp4 and .webm and tour-poster.webp, and prints the
// chapter times and length to paste into src/app/welcome/tour.tsx.
// The demo hotel's data is changed by the recording, so re-seed before recording again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "innvela-tour-"));
const publicDir = path.resolve("public/welcome");
fs.mkdirSync(`${outDir}/frames`, { recursive: true });

const OVERLAY = `
(() => {
  if (window.top !== window) return;
  const css = \`
    #demo-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
      transition: left .65s cubic-bezier(.45,.05,.25,1), top .65s cubic-bezier(.45,.05,.25,1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #demo-ripple { position: fixed; z-index: 2147483646; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(11,79,138,.35); pointer-events: none; transform: scale(.2); opacity: 0; }
    #demo-ripple.on { animation: demo-ripple .55s ease-out; }
    @keyframes demo-ripple { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }
    #demo-caption { position: fixed; z-index: 2147483645; left: 50%; bottom: 34px; transform: translateX(-50%); width: min(860px, calc(100% - 48px));
      background: rgba(15,23,42,.95); color: #fff; padding: 12px 18px; display: flex; gap: 14px; align-items: center;
      font-family: "Segoe UI", Tahoma, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(15,23,42,.35); pointer-events: none; }
    #demo-caption[hidden] { display: none !important; }
    #demo-caption .n { flex: none; background: #0b4f8a; color: #fff; font-weight: 700; font-size: 15px; padding: 5px 11px; }
    #demo-caption .t { font-weight: 700; font-size: 20px; line-height: 1.2; }
    #demo-caption .s { font-size: 15px; color: #cbd5e1; margin-top: 3px; line-height: 1.35; }
    #demo-card { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; text-align: center; color: #fff;
      background: #0f172a; font-family: "Segoe UI", Tahoma, system-ui, sans-serif; transition: opacity .6s; }
    #demo-card .m svg { display: block; width: 88px; height: 88px; margin: 0 auto 14px; }
    #demo-card[hidden] { display: none !important; }
    #demo-card .k { font-size: 17px; font-weight: 600; color: #93a4c3; }
    #demo-card .h { font-size: 52px; font-weight: 800; margin: 8px 0 10px; letter-spacing: -.01em; }
    #demo-card .p { font-size: 21px; color: #dbe3ef; max-width: 780px; line-height: 1.4; }
    /* Blurred: everything outside the part being shown, and always the full list of sections. */
    .demo-blur { filter: blur(7px) saturate(.7) !important; opacity: .8; transition: filter .45s, opacity .45s; }
    nav[aria-label="Main"] { filter: blur(6px) saturate(.7); }
    /* Veiled: a page just opened is fully blurred until spot() chooses what to show. */
    html.demo-veil body > *:not([id^="demo-"]) { filter: blur(7px) saturate(.7); opacity: .8; }
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
    card.innerHTML = '<div><div class="m"><svg viewBox="0 0 64 64"><path d="M10 30L32 12l22 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 33l13 19 13-19" fill="none" stroke="#7c93ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="k"></div><div class="h"></div><div class="p"></div></div>';
    document.body.append(cur, ripple, cap, card);
    const saved = JSON.parse(sessionStorage.getItem('demo-state') || '{}');
    if (saved.veil) document.documentElement.classList.add('demo-veil');
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
    // Keep only these elements sharp: blur every other branch of the page around them.
    veil(on) { save({ veil: on }); document.documentElement.classList.toggle('demo-veil', on); },
    spot(els) {
      document.documentElement.classList.remove('demo-veil');
      document.querySelectorAll('.demo-blur').forEach((e) => e.classList.remove('demo-blur'));
      if (!els || !els.length) return;
      const keep = new Set();
      for (const el of els) for (let n = el; n; n = n.parentElement) keep.add(n);
      for (const a of keep) {
        if (els.includes(a) || a === document.documentElement) continue;
        for (const c of a.children) {
          if (keep.has(c) || (c.id || '').startsWith('demo-') || ['SCRIPT', 'STYLE', 'LINK', 'HEAD', 'NOSCRIPT'].includes(c.tagName)) continue;
          c.classList.add('demo-blur');
        }
      }
    },
  };
  // Blur a new page from its very first paint (before the rest of the overlay is added).
  try {
    if (JSON.parse(sessionStorage.getItem('demo-state') || '{}').veil) {
      document.documentElement.classList.add('demo-veil');
      const early = document.createElement('style');
      early.textContent = 'html.demo-veil body > *:not([id^="demo-"]) { filter: blur(7px) saturate(.7); opacity: .8; }';
      document.documentElement.appendChild(early);
    }
  } catch {}
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

const chapters = [];
const wait = (ms) => page.waitForTimeout(ms);
async function caption(n, title, sub) {
  chapters.push({ n, title, sub, at: Date.now() / 1000 });
  await page.evaluate(([n, t, s]) => window.__demo.caption(String(n), t, s), [n, title, sub]);
  await wait(1500);
}
/** Keep these sharp and blur the rest of the screen. No arguments: nothing blurred. */
async function spot(...locators) {
  const handles = [];
  for (const l of locators) handles.push(...(await l.elementHandles()));
  await page.evaluate((els) => window.__demo.spot(els), handles);
  await wait(500);
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
  try {
    await locator.click({ timeout: 8000 });
  } catch (e) {
    await page.screenshot({ path: `${outDir}/failed.png` });
    console.error(`Could not click during chapter ${chapters.at(-1)?.n ?? 0}; screen saved at ${outDir}/failed.png`);
    throw e;
  }
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
/** The panel (white box) around a heading or label. */
const panel = (locator) => locator.locator("xpath=ancestor::div[contains(@class,'bg-white')][1]");
async function dismissRateTip() {
  const seen = page.getByPlaceholder("I have seen");
  if (await seen.isVisible().catch(() => false)) {
    await seen.fill("I have seen");
    await page.getByRole("button", { name: "Close" }).last().click();
    await wait(300);
  }
}
async function openApp(url) {
  await page.goto(base + url, { waitUntil: "networkidle" });
  await wait(400);
  await dismissRateTip();
}
const addDays = (key, n) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------------- Intro + 1. Guest books online ----------------
await page.goto(base + "/book/sunrise-residency", { waitUntil: "networkidle" });
await page.evaluate(() => window.__demo.card("A short look at", "Innvela", "Hotel front-desk software. A few highlights: book a demo to see the rest."));
await wait(3400);
await page.evaluate(() => window.__demo.card(null));
await wait(700);
await caption(1, "Guests book on your own website", "Live prices and free rooms. Guests book direct, so no commission to pay.");
const arrival = await page.getByLabel("Arrival").inputValue();
await click(page.getByLabel("Departure"), 300);
await page.getByLabel("Departure").fill(addDays(arrival, 2));
await wait(400);
await click(page.getByRole("button", { name: "Check prices" }), 1200);
await page.getByRole("button", { name: "Book this room" }).first().waitFor();
await click(page.getByRole("button", { name: "Book this room" }).first(), 900);
await type(page.getByLabel("First name"), "Kavya");
await type(page.getByLabel("Last name"), "Rao");
await type(page.getByLabel("Mobile number"), "+91 98450 22110");
const terms = page.locator("input[type=checkbox]");
if (await terms.count()) await click(terms.first(), 300);
await click(page.getByRole("button", { name: /Confirm booking/ }), 600);
await page.waitForURL(/\/book\/confirmation\//);
await wait(2600);

// ---------------- 2. Dashboard ----------------
const login = await ctx.request.post(base + "/api/auth/login", { data: { email: "admin@hotel.com", password: "admin123" } });
if (!login.ok()) throw new Error("login failed");
await page.evaluate(() => window.__demo.veil(true)); // from here on, each screen opens blurred
await openApp("/");
const roomsTonight = panel(page.getByText("Rooms tonight", { exact: true }));
await spot(page.locator("main").getByRole("heading", { name: "Dashboard" }), roomsTonight);
await caption(2, "Every room on one screen", "Who is in, who is arriving, what is free tonight, its category and tonight's price.");
await point(roomsTonight, 900);
await point(roomsTonight.getByText("Free tonight", { exact: true }), 1800);
await scrollTo(0, 600);
const arriving = panel(page.getByText(/^Arriving today/).first());
const leaving = panel(page.getByText(/^Leaving today/).first());
await spot(arriving, leaving);
await point(arriving.getByText("Kavya Rao").first(), 1600);

// ---------------- 3. Express check-in ----------------
await spot(page.getByRole("button", { name: /Send express check-in/ }).first());
await caption(3, "Express check-in on WhatsApp", "Send a link. The guest fills in their own details before they arrive.");
await click(page.getByRole("button", { name: /Send express check-in/ }).first(), 900);
const sendBox = page.getByRole("dialog");
await spot(sendBox);
await type(sendBox.getByLabel("Guest's WhatsApp number"), "98201 33445");
await type(sendBox.getByLabel(/Guest's name/), "Arjun Mehta");
await click(sendBox.getByRole("button", { name: /Make the link/ }), 1200);
await point(sendBox.getByText(/WhatsApp/).last(), 1800);
await page.keyboard.press("Escape");
await wait(600);

// ---------------- 4. Check in ----------------
await spot(arriving);
await caption(4, "Check in with one tap", "Reminders if the room isn't clean yet or an adult's ID hasn't been checked.");
await click(arriving.locator("tr", { has: page.getByText("Kavya Rao", { exact: true }) }).getByRole("button", { name: "Check in" }), 1200);
await spot(page.getByRole("dialog"));
await wait(1800);
await click(page.getByRole("button", { name: "Yes, check in" }), 800);
// Straight after check-in the desk is offered the welcome message for WhatsApp.
const welcome = page.getByRole("dialog");
if (await welcome.isVisible().catch(() => false)) {
  await spot(welcome);
  await wait(2200);
  await page.keyboard.press("Escape");
  await wait(600);
}

// ---------------- 5. Check out + GST invoice ----------------
await spot(leaving);
await caption(5, "Check out, and the GST invoice is ready", "Take cash, UPI or card. The invoice has CGST, SGST and the amount in words.");
await click(leaving.getByRole("button", { name: "Check out" }).first(), 1200);
const outBox = page.getByRole("dialog");
await spot(outBox);
await wait(1400);
await click(outBox.getByRole("button", { name: "Cash", exact: true }), 600);
await click(outBox.getByRole("button", { name: /check out/i }).last(), 1200);
const lastOut = await page.evaluate(async () => {
  const r = await (await fetch("/api/bookings")).json();
  return r.filter((b) => b.status === "checked_out").sort((a, b) => String(b.actualCheckOut || "").localeCompare(String(a.actualCheckOut || "")))[0].id;
});
await page.goto(base + `/print/invoice/${lastOut}`, { waitUntil: "networkidle" });
const invoice = page.locator(".print-page");
await spot(invoice.locator("> div").first(), invoice.getByText("Amount in words:").locator(".."), invoice.locator("table").nth(1));
await wait(600);
await point(invoice.getByText("Amount in words:"), 2600);

// ---------------- 6. Day sheet ----------------
await openApp("/");
await spot(page.getByRole("link", { name: /Day sheet/ }).first());
await caption(6, "The day sheet", "Print it each morning or send it on WhatsApp: every guest, phone and amount due.");
await point(page.getByRole("link", { name: /Day sheet/ }).first(), 300);
await page.evaluate(() => window.__demo.ripple());
await wait(500);
await page.goto(base + "/print/day-sheet", { waitUntil: "networkidle" });
await page.getByText(/^In the hotel/).waitFor();
await spot(page.getByText(/^In the hotel/).locator(".."), page.getByRole("button", { name: /Send on WhatsApp/ }), page.getByRole("button", { name: "Print" }));
await point(page.getByText(/^In the hotel/), 1400);
await point(page.getByRole("button", { name: /Send on WhatsApp/ }), 1600);

// ---------------- 7. No internet ----------------
await openApp("/");
await wait(1500); // let the offline copy catch up with the check-in and check-out
await caption(7, "When the internet goes", "The Dashboard and day sheet still open from the copy saved on the computer.");
await ctx.setOffline(true);
await page.reload({ waitUntil: "load" });
await dismissRateTip();
await page.getByText("Cannot reach the server.").waitFor();
await spot(page.getByRole("alert").filter({ hasText: "No internet." }), page.getByRole("alert").filter({ hasText: "Cannot reach the server." }), roomsTonight);
await point(page.getByText("Cannot reach the server."), 2600);
await ctx.setOffline(false);

// ---------------- 8. Install as an app ----------------
await openApp("/");
await page.evaluate(() => {
  // The browser's real install offer cannot appear in a recording, so send the same event.
  const e = new Event("beforeinstallprompt", { cancelable: true });
  e.prompt = async () => {};
  e.userChoice = Promise.resolve({ outcome: "dismissed" });
  window.dispatchEvent(e);
});
await wait(300);
const installButton = page.getByRole("button", { name: "Install app" });
await spot(installButton, page.locator("div.bg-primary-600 span").first());
await caption(8, "Install it like desktop software", "Its own window and an icon on the desktop and taskbar. Updates arrive by themselves.");
await point(installButton, 2600);

// ---------------- 9. Reports ----------------
await openApp("/reports");
await page.getByText(/^Profit · /).first().waitFor();
const profit = panel(page.getByText(/^Profit · /).first());
await spot(profit);
await caption(9, "Your profit, day by day", "Earnings minus expenses for any day, week, month or year.");
await point(profit.getByText("Total earnings", { exact: true }), 1200);
await point(profit.getByText(/^(Profit|Loss)$/).first(), 2200);

// ---------------- End card ----------------
await page.evaluate(() => window.__demo.caption(null));
chapters.push({ n: "end", title: "End", at: Date.now() / 1000 });
await page.evaluate(() => window.__demo.card("And much more", "See all of Innvela in a free demo", "Reservations, housekeeping, staff shifts, rate tips, Pathik, expenses, reports and more."));
await wait(4200);

await cdp.send("Page.stopScreencast");
await wait(300);
await browser.close();

// ---------------- Encode ----------------
const first = frames[0];
const start = Math.max(0, chapters[0].at - first - 4.1); // the title card shows ~4s before chapter 1
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
execFileSync(ffmpeg, [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", `${publicDir}/innvela-tour.mp4`], { stdio: "inherit" });
execFileSync(ffmpeg, [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${publicDir}/innvela-tour.webm`], { stdio: "inherit" });

const times = chapters.filter((c) => c.n !== "end").map((c) => ({ t: Math.round((c.at - first - start) * 10) / 10, title: c.title }));
times[0].t = 0;
// Poster: the Dashboard chapter, a moment after it starts.
const posterAt = (times[1]?.t ?? 8) + 2.5;
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", String(posterAt), "-i", `${publicDir}/innvela-tour.mp4`, "-frames:v", "1", "-vf", "scale=1280:-2", "-c:v", "libwebp", "-quality", "82", `${publicDir}/tour-poster.webp`], { stdio: "inherit" });
fs.rmSync(outDir, { recursive: true, force: true });

const length = frames.at(-1) - first - start;
console.log(`Saved public/welcome/innvela-tour.mp4, .webm and tour-poster.webp (${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, "0")}).`);
console.log("Paste these into CHAPTERS in src/app/welcome/tour.tsx:");
for (const c of times) console.log(`  { t: ${c.t}, title: ${JSON.stringify(c.title)} },`);
