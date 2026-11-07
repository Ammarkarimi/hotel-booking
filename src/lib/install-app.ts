"use client";

// "Install app": Chrome and Edge offer to install the site as an app (its own window and a
// desktop / taskbar icon). The browser announces it with a beforeinstallprompt event, which
// is kept here so the title bar can show its own Install app button.
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let saved: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the browser's banner
    saved = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    saved = null;
    notify();
  });
}

/** True when this window is the installed app rather than a browser tab. */
export function isInstalledApp() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches);
}

/** canInstall: the browser will install it now. install(): shows the browser's install box. */
export function useInstallApp() {
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const update = () => setCanInstall(saved !== null && !isInstalledApp());
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function install() {
    const e = saved;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") saved = null; // the browser offers it only once
    notify();
  }

  return { canInstall, install };
}
