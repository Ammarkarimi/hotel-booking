// Offline copy of the Dashboard and the Day sheet.
//
// While the internet works, this keeps the latest copy of two pages (the Dashboard at "/" and
// the Day sheet), the Dashboard's data, and the script and style files those pages need.
// When the internet (or the server) cannot be reached, the saved copies are shown instead,
// with the time they were saved, so the desk can still see who is in which room.
// Nothing can be changed offline: every other request goes to the server as normal.
//
// Pages are saved only when the server says the person is signed in (the x-signed-in header
// set by the middleware). Signing out, or opening the sign-in page, deletes every copy.

const PREFIX = "innvela-offline";
const PAGES = `${PREFIX}-pages-v1`;
const FILES = `${PREFIX}-files-v1`;
const DATA = `${PREFIX}-data-v1`;
const KEEP = [PAGES, FILES, DATA];

const OFFLINE_PAGES = ["/", "/print/day-sheet"];
const DASHBOARD_API = "/api/dashboard";
const WARM_EVERY_MS = 10 * 60 * 1000;
let lastWarm = 0;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function clearAll() {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith(PREFIX)).map((n) => caches.delete(n)));
}

/** The /_next/static files a page (or a style sheet) refers to. */
function staticUrls(text) {
  const found = new Set();
  for (const m of text.matchAll(/\/_next\/static\/[^"'()\s\\]+/g)) found.add(m[0]);
  return [...found];
}

/** Save the files the saved pages need, and drop files no saved page needs any more. */
async function syncFiles() {
  const pages = await caches.open(PAGES);
  const files = await caches.open(FILES);
  const needed = new Set();
  for (const req of await pages.keys()) {
    const res = await pages.match(req);
    if (res) for (const u of staticUrls(await res.text())) needed.add(u);
  }
  // Style sheets refer to fonts.
  for (const u of [...needed]) {
    if (!u.endsWith(".css")) continue;
    let res = await files.match(u);
    if (!res) {
      try {
        res = await fetch(u);
        if (res.ok) await files.put(u, res.clone());
      } catch {
        continue;
      }
    }
    if (res && res.ok) for (const f of staticUrls(await res.text())) needed.add(f);
  }
  await Promise.all(
    [...needed].map(async (u) => {
      if (await files.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok) await files.put(u, res);
      } catch {
        // Try again next time.
      }
    }),
  );
  for (const req of await files.keys()) {
    if (!needed.has(new URL(req.url).pathname)) await files.delete(req);
  }
}

async function savePage(path, res) {
  if (!res.ok || res.headers.get("x-signed-in") !== "1") return;
  const cache = await caches.open(PAGES);
  await cache.put(path, res);
  await syncFiles();
}

async function saveData(res) {
  const body = await res.text();
  const headers = new Headers(res.headers);
  headers.set("x-saved-at", new Date().toISOString());
  const cache = await caches.open(DATA);
  await cache.put(DASHBOARD_API, new Response(body, { status: 200, headers }));
}

/** Refresh every saved copy in the background (sent by the app once it has loaded). */
async function warm() {
  if (Date.now() - lastWarm < WARM_EVERY_MS) return;
  lastWarm = Date.now();
  try {
    const data = await fetch(DASHBOARD_API, { cache: "no-store" });
    if (data.status === 401) return clearAll();
    if (data.ok) await saveData(data);
    for (const path of OFFLINE_PAGES) {
      const res = await fetch(path, { cache: "no-store", headers: { Accept: "text/html" } });
      await savePage(path, res);
    }
  } catch {
    lastWarm = 0; // offline right now: try again on the next message
  }
}

const offlinePage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No internet</title>
<style>body{font:14px/1.5 system-ui,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:24px}div{max-width:460px;margin:40px auto;background:#fff;border:1px solid #cbd5e1;padding:20px}h1{font-size:17px;margin:0 0 8px}a{display:inline-block;margin:12px 12px 0 0;padding:6px 12px;border:1px solid #94a3b8;color:#0f172a;text-decoration:none;font-weight:600}</style></head>
<body><div><h1>No internet</h1><p>This screen cannot open without the internet. The Dashboard and the Day sheet open from the copy saved on this computer, so you can see who is in which room. Write any check-ins, check-outs and payments on the Day sheet and enter them when the internet is back.</p>
<a href="/">Dashboard</a><a href="/print/day-sheet">Day sheet</a><a href="" onclick="location.reload();return false">Try again</a></div></body></html>`;

function offlineResponse() {
  return new Response(offlinePage, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handlePage(event, path) {
  try {
    const res = await fetch(event.request);
    if (OFFLINE_PAGES.includes(path)) event.waitUntil(savePage(path, res.clone()));
    return res;
  } catch {
    if (OFFLINE_PAGES.includes(path)) {
      const saved = await caches.match(path, { cacheName: PAGES });
      if (saved) return saved;
    }
    return offlineResponse();
  }
}

async function handleDashboardData(event) {
  let res;
  try {
    res = await fetch(event.request);
    if (res.ok) {
      event.waitUntil(saveData(res.clone()));
      return res;
    }
    if (res.status === 401) {
      event.waitUntil(clearAll());
      return res;
    }
    if (res.status < 500) return res;
  } catch {
    res = null;
  }
  // The server cannot be reached (or is failing): give the saved copy, marked with its time.
  const saved = await caches.match(DASHBOARD_API, { cacheName: DATA });
  if (!saved) {
    return res ?? new Response(JSON.stringify({ error: "Cannot reach the server. Please check your internet connection." }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  const data = await saved.json();
  data.offlineSavedAt = saved.headers.get("x-saved-at");
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleFile(event) {
  const saved = await caches.match(event.request, { cacheName: FILES });
  return saved ?? fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") return event.respondWith(handlePage(event, url.pathname));
  if (url.pathname === DASHBOARD_API) return event.respondWith(handleDashboardData(event));
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(handleFile(event));
});

self.addEventListener("message", (event) => {
  if (event.data === "warm") event.waitUntil(warm());
  if (event.data === "clear") event.waitUntil(clearAll());
});
