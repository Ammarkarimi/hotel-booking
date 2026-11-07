"use client";

// The window around every signed-in page, laid out like desktop software:
//   title bar  (hotel, who is signed in, sign out)
//   menu tabs  (every section; on phones a Menu button opens the same list)
//   toolbar    (the everyday actions with keyboard keys, search, shift)
//   page
//   status bar (date, time, keyboard keys)

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarPlus, ClipboardCheck, Menu, Search, Send, UserPlus, X } from "lucide-react";
import { cn, label } from "@/lib/utils";
import { api } from "@/lib/client";
import { AppProvider, useApp, type ShellSettings } from "@/components/app-provider";
import { Button, StatusBadge } from "@/components/ui";
import { ShiftControl } from "@/components/shift";
import { RateTipPopup } from "@/components/rate-tips";
import { SendGuestFormDialog } from "@/components/guest-form-send";
import { LogoMark } from "@/components/brand";
import type { SessionUser } from "@/lib/session";
import { moduleForPath, notInPackageMessage, type ModuleKey } from "@/lib/modules";
import { clearOffline, startOffline, useOnline } from "@/lib/offline";

const NAV: Array<{ href: string; label: string; hint: string; admin?: boolean; module?: ModuleKey }> = [
  { href: "/", label: "Dashboard", hint: "What is happening now" },
  { href: "/calendar", label: "Calendar", hint: "Which rooms are free" },
  { href: "/bookings", label: "Bookings", hint: "All reservations" },
  { href: "/guests", label: "Guests", hint: "Guest records & IDs" },
  { href: "/guest-forms", label: "Express check-in", hint: "Guests fill in their details on WhatsApp", module: "guest_forms" },
  { href: "/housekeeping", label: "Housekeeping", hint: "Room cleaning" },
  { href: "/payments", label: "Payments", hint: "Money received" },
  { href: "/expenses", label: "Expenses", hint: "Money spent", module: "expenses" },
  { href: "/rooms", label: "Rooms", hint: "Your rooms & prices" },
  { href: "/rate-tips", label: "Rate tips", hint: "Fill tonight's empty rooms", module: "rate_tips" },
  { href: "/reports", label: "Reports", hint: "Business summary", admin: true, module: "reports" },
  { href: "/shifts", label: "Shifts", hint: "Attendance & handover notes", admin: true, module: "shifts" },
  { href: "/settings", label: "Settings", hint: "Hotel details & staff", admin: true },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** New shift reports and handovers, for the owner's Shifts tab. */
function useUnreadShifts(isAdmin: boolean) {
  const pathname = usePathname();
  const { has } = useApp();
  const on = has("shifts");
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!isAdmin || !on) return;
    const load = () =>
      api<{ unread?: number; waitingHandovers?: number }>("/api/shifts/current")
        .then((r) => setUnread((r.unread ?? 0) + (r.waitingHandovers ?? 0)))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [isAdmin, on, pathname]);
  return unread;
}

/** How many guests have sent their WhatsApp form and wait for a room. Tells the desk when a new one arrives. */
function useFormsWaiting() {
  const { toast, has } = useApp();
  const on = has("guest_forms");
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!on) return;
    const load = () =>
      api<{ received: number }>("/api/guest-forms?count=1")
        .then(({ received }) => {
          const added = last.current === null ? 0 : received - last.current;
          if (added > 0) toast(added === 1 ? "A guest has filled in express check-in. Choose a room in Express check-in." : `${added} guests have filled in express check-in. See Express check-in.`);
          last.current = received;
          setCount(received);
        })
        .catch(() => undefined);
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("guest-forms-changed", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("guest-forms-changed", load);
    };
  }, [on, pathname, toast]);
  return count;
}

function Count({ n, label: text }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="rounded-sm bg-red-700 px-1 text-[11px] font-bold leading-4 text-white" aria-label={text}>
      {n}
    </span>
  );
}

function MenuTabs({ formsWaiting, unread, onNavigate, vertical }: { formsWaiting: number; unread: number; onNavigate?: () => void; vertical?: boolean }) {
  const pathname = usePathname();
  const { isAdmin, has } = useApp();
  return (
    <>
      {NAV.filter((n) => (!n.admin || isAdmin) && (!n.module || has(n.module))).map((item) => {
        const active = isActive(pathname, item.href);
        const badge =
          item.href === "/guest-forms" ? <Count n={formsWaiting} label={`${formsWaiting} express check-ins need a room`} /> : item.href === "/shifts" ? <Count n={unread} label={`${unread} new shift reports`} /> : null;
        return vertical ? (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5", active ? "bg-primary-50 font-bold text-primary-800" : "text-slate-800")}
          >
            <span>
              <span className="block">{item.label}</span>
              <span className="block text-xs font-normal text-slate-500">{item.hint}</span>
            </span>
            {badge}
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            title={item.hint}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border px-3 py-1.5 text-[13px]",
              active ? "border-chrome-line border-b-white bg-white font-bold text-slate-900" : "border-transparent text-slate-800 hover:text-primary-700 hover:underline"
            )}
          >
            {item.label}
            {badge}
          </Link>
        );
      })}
    </>
  );
}

interface SearchResults {
  guests: Array<{ id: string; name: string; phone: string }>;
  bookings: Array<{ id: string; number: number; guestName: string; room: string; status: string; checkIn: string; checkOut: string }>;
  rooms: Array<{ id: string; roomNumber: string; type: string }>;
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`).then(setResults).catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const empty = results && !results.guests.length && !results.bookings.length && !results.rooms.length;
  const groupTitle = "border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600";
  const rowClass = "flex w-full items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 text-left text-[13px] hover:bg-primary-50";

  return (
    <div ref={box} className="relative w-full sm:w-80">
      <label htmlFor="global-search" className="sr-only">
        Find a guest, booking or room
      </label>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id="global-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setOpen(false))}
        placeholder="Find name, phone, booking no. or room  ( / )"
        className="min-h-8 w-full rounded-sm border border-chrome-line bg-white pl-7 pr-2 text-[13px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto border border-chrome-line bg-white shadow-lg">
          {empty && <p className="px-3 py-3 text-center text-[13px] text-slate-500">Nothing found for “{q}”</p>}
          {results.bookings.length > 0 && <p className={groupTitle}>Bookings</p>}
          {results.bookings.map((b) => (
            <button key={b.id} onClick={() => go(`/bookings/${b.id}`)} className={rowClass}>
              <span>
                <span className="block font-semibold">
                  #{b.number} {b.guestName}
                </span>
                <span className="block text-xs text-slate-500">
                  Room {b.room}, {b.checkIn} to {b.checkOut}
                </span>
              </span>
              <StatusBadge status={b.status} />
            </button>
          ))}
          {results.guests.length > 0 && <p className={groupTitle}>Guests</p>}
          {results.guests.map((g) => (
            <button key={g.id} onClick={() => go(`/guests/${g.id}`)} className={rowClass}>
              <span className="font-semibold">{g.name}</span>
              <span className="text-xs text-slate-500">{g.phone}</span>
            </button>
          ))}
          {results.rooms.length > 0 && <p className={groupTitle}>Rooms</p>}
          {results.rooms.map((r) => (
            <button key={r.id} onClick={() => go(`/calendar?room=${r.id}`)} className={rowClass}>
              <span className="font-semibold">Room {r.roomNumber}</span>
              <span className="text-xs text-slate-500">{label(r.type)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span>
      {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone })}{" "}
      {now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone })}
    </span>
  );
}

/** F2 new booking, F3 walk-in, F4 calendar, / to search. */
function useShortcuts(openSearch: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('[role="dialog"]')) return; // a window is open: leave the keys to it
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if (e.key === "F2") (e.preventDefault(), router.push("/bookings/new"));
      else if (e.key === "F3") (e.preventDefault(), router.push("/bookings/new?walkin=1"));
      else if (e.key === "F4") (e.preventDefault(), router.push("/calendar"));
      else if (e.key === "/" && !typing) (e.preventDefault(), openSearch());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openSearch]);
}

function focusSearch() {
  document.getElementById("global-search")?.focus();
}

function Shell({ children }: { children: React.ReactNode }) {
  const { settings, user, isAdmin, has } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  const formsWaiting = useFormsWaiting();
  const unread = useUnreadShifts(isAdmin);
  useShortcuts(focusSearch);
  // A page from a module the package does not include (an old link or bookmark).
  const pageModule = moduleForPath(pathname);
  const lockedModule = pageModule && !has(pageModule) ? pageModule : null;
  const online = useOnline();

  // Keep a copy of the Dashboard and Day sheet on this computer for when the internet goes.
  useEffect(() => {
    startOffline();
    const t = setInterval(startOffline, 10 * 60_000);
    return () => clearInterval(t);
  }, []);

  async function handleLogout() {
    await clearOffline();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const barLink = "text-white hover:underline";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Title bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-primary-600 px-3 py-1 text-[13px] text-white">
        <span className="flex min-w-0 items-center gap-2">
          <LogoMark className="h-4 w-4 shrink-0" tone="dark" />
          <span className="truncate font-bold">Innvela: {settings.hotelName}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="hidden sm:inline">
            {user.name} ({label(user.role)})
          </span>
          {has("website") && (
            <a href={`/book/${settings.bookingSlug}`} target="_blank" rel="noopener noreferrer" className={cn(barLink, "hidden md:inline")}>
              Online booking page
            </a>
          )}
          <Link href="/help" className={barLink}>
            Help
          </Link>
          <Link href="/account" className={barLink}>
            My account
          </Link>
          <button onClick={handleLogout} className={cn(barLink, "font-bold")}>
            Sign out
          </button>
        </span>
      </div>

      {/* Menu tabs */}
      <nav aria-label="Main" className="no-print hidden flex-wrap border-b border-chrome-line bg-slate-50 px-2 pt-1 lg:flex">
        <MenuTabs formsWaiting={formsWaiting} unread={unread} />
      </nav>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-1.5 border-b border-slate-300 bg-white px-3 py-1.5">
        <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu className="h-4 w-4" /> Menu
        </Button>
        <Link href="/bookings/new">
          <Button size="sm">
            <CalendarPlus className="h-4 w-4" /> New booking <kbd className="hidden font-sans text-[11px] opacity-80 sm:inline">F2</kbd>
          </Button>
        </Link>
        <Link href="/bookings/new?walkin=1">
          <Button size="sm" variant="outline">
            <UserPlus className="h-4 w-4" /> Walk-in <kbd className="hidden font-sans text-[11px] text-slate-500 sm:inline">F3</kbd>
          </Button>
        </Link>
        <Link href="/calendar" className="hidden sm:block">
          <Button size="sm" variant="outline">
            <CalendarDays className="h-4 w-4" /> Calendar <kbd className="font-sans text-[11px] text-slate-500">F4</kbd>
          </Button>
        </Link>
        {has("guest_forms") && (
          <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Send express check-in
          </Button>
        )}
        {has("guest_forms") && formsWaiting > 0 && pathname !== "/guest-forms" && (
          <Link href="/guest-forms" title="Express check-ins waiting for a room">
            <Button size="sm" variant="warning">
              <ClipboardCheck className="h-4 w-4" /> {formsWaiting} check-in{formsWaiting === 1 ? "" : "s"} waiting
            </Button>
          </Link>
        )}
        {has("shifts") && (
          <div className="[&_button]:min-h-8 [&_button]:px-2.5 [&_button]:text-[13px] [&_span]:text-[13px]">
            <ShiftControl />
          </div>
        )}
        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
          <GlobalSearch />
        </div>
      </div>

      {settings.subscriptionNotice && (
        <div role="status" className="no-print border-b border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-900">
          {settings.subscriptionNotice}
        </div>
      )}

      {!online && (
        <div role="alert" className="no-print border-b border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-900">
          <b>No internet.</b> The Dashboard and the{" "}
          <a href="/print/day-sheet" target="_blank" className="font-semibold underline">
            Day sheet
          </a>{" "}
          show the copy saved on this computer. Nothing can be saved until the internet is back: write check-ins, check-outs and payments on the Day sheet and enter them later.
        </div>
      )}

      <main className="flex-1 px-3 pb-12 pt-3 sm:px-4">{lockedModule ? <NotInPackage module={lockedModule} /> : children}</main>

      {/* Status bar */}
      <footer className="no-print fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-x-5 border-t border-chrome-line bg-slate-50 px-3 py-1 text-xs text-slate-700">
        <Clock timeZone={settings.timezone} />
        <span className="hidden sm:inline">{settings.hotelName}</span>
        <span className="ml-auto hidden gap-4 md:flex">
          <span>
            <b>F2</b> New booking
          </span>
          <span>
            <b>F3</b> Walk-in
          </span>
          <span>
            <b>F4</b> Calendar
          </span>
          <span>
            <b>/</b> Find
          </span>
        </span>
      </footer>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-chrome-line bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-primary-600 px-4 py-2 text-white">
              <span className="font-bold">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="rounded-sm p-1 hover:bg-red-600" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main" className="flex-1 overflow-y-auto">
              <MenuTabs formsWaiting={formsWaiting} unread={unread} onNavigate={() => setMenuOpen(false)} vertical />
              {has("guest_forms") && (
                <button onClick={() => (setMenuOpen(false), setSendOpen(true))} className="block w-full border-b border-slate-200 px-4 py-2.5 text-left text-slate-800">
                  Send express check-in
                </button>
              )}
              {has("website") && (
                <a href={`/book/${settings.bookingSlug}`} target="_blank" rel="noopener noreferrer" className="block border-b border-slate-200 px-4 py-2.5 text-slate-800">
                  Online booking page
                </a>
              )}
            </nav>
          </div>
        </div>
      )}

      {has("guest_forms") && <SendGuestFormDialog open={sendOpen} onClose={() => setSendOpen(false)} />}
      {has("rate_tips") && <RateTipPopup />}
    </div>
  );
}

function NotInPackage({ module }: { module: ModuleKey }) {
  return (
    <div className="mx-auto mt-6 max-w-lg border border-chrome-line bg-white">
      <div className="border-b border-chrome-line bg-chrome px-3 py-1.5 text-[13px] font-bold text-slate-800">Not in your package</div>
      <div className="space-y-3 p-4 text-[14px] text-slate-700">
        <p>{notInPackageMessage(module)}</p>
        <Link href="/" className="font-semibold text-primary-700 underline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export function AppLayout({ user, settings, children }: { user: SessionUser; settings: ShellSettings; children: React.ReactNode }) {
  return (
    <AppProvider user={user} settings={settings}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
