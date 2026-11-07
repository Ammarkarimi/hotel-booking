"use client";

// The browser side of the offline copy (public/sw.js): switch it on, keep it fresh, and
// delete it when someone signs out so the next person on the computer cannot see it.
import { useEffect, useState } from "react";

const PREFIX = "innvela-offline";

/** Start the offline helper and ask it to refresh its saved copies. Production only. */
export function startOffline() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => reg.active?.postMessage("warm"))
    .catch(() => undefined);
}

/** Delete every saved copy (on sign out, and whenever the sign-in page opens). */
export async function clearOffline() {
  try {
    if (!("caches" in window)) return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX)).map((n) => caches.delete(n)));
  } catch {
    // Nothing saved, or the browser does not allow it.
  }
}

/** False while this computer has no network at all. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
