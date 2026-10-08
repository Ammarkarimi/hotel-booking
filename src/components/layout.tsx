"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BedDouble,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Globe,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserCircle,
  Users,
  Wallet,
  X,
  Hotel,
} from "lucide-react";
import { cn, label } from "@/lib/utils";
import { api } from "@/lib/client";
import { AppProvider, useApp, type ShellSettings } from "@/components/app-provider";
import { Button, StatusBadge } from "@/components/ui";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Today", icon: Home, hint: "What is happening now" },
  { href: "/calendar", label: "Room Calendar", icon: CalendarDays, hint: "Which rooms are free" },
  { href: "/bookings", label: "Bookings", icon: ClipboardList, hint: "All reservations" },
  { href: "/guests", label: "Guests", icon: Users, hint: "Guest records & IDs" },
  { href: "/housekeeping", label: "Housekeeping", icon: Sparkles, hint: "Room cleaning" },
  { href: "/payments", label: "Payments", icon: Wallet, hint: "Money received" },
  { href: "/rooms", label: "Rooms", icon: BedDouble, hint: "Your rooms & prices" },
  { href: "/reports", label: "Reports", icon: BarChart3, hint: "Business summary", admin: true },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Hotel details & staff", admin: true },
];

const FOOTER_NAV = [
  { href: "/help", label: "Help & guide", icon: HelpCircle },
  { href: "/account", label: "My account", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, settings } = useApp();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="rounded-xl bg-primary-600 p-2 text-white">
          <Hotel className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{settings.hotelName}</p>
          <p className="text-xs text-slate-500">Hotel manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.filter((n) => !n.admin || isAdmin).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
                <span className="block text-xs text-slate-400">{item.hint}</span>
              </span>
            </Link>
          );
        })}

        <div className="my-3 border-t border-slate-100" />
        <a
          href="/book"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-50"
        >
          <Globe className="h-5 w-5 text-slate-400" />
          <span className="text-[15px] font-semibold">Online booking page</span>
        </a>
        {FOOTER_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-primary-600" : "text-slate-400")} />
              <span className="text-[15px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{label(user.role)}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
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

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search guest name, phone, booking # or room"
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[15px] outline-none transition focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {empty && <p className="px-3 py-4 text-center text-sm text-slate-500">Nothing found for “{q}”</p>}
          {results.bookings.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Bookings</p>}
          {results.bookings.map((b) => (
            <button key={b.id} onClick={() => go(`/bookings/${b.id}`)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50">
              <span>
                <span className="block text-sm font-semibold">#{b.number} · {b.guestName}</span>
                <span className="block text-xs text-slate-500">Room {b.room} · {b.checkIn} → {b.checkOut}</span>
              </span>
              <StatusBadge status={b.status} />
            </button>
          ))}
          {results.guests.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Guests</p>}
          {results.guests.map((g) => (
            <button key={g.id} onClick={() => go(`/guests/${g.id}`)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">
              <span className="block text-sm font-semibold">{g.name}</span>
              <span className="block text-xs text-slate-500">{g.phone}</span>
            </button>
          ))}
          {results.rooms.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Rooms</p>}
          {results.rooms.map((r) => (
            <button key={r.id} onClick={() => go(`/calendar?room=${r.id}`)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">
              <span className="text-sm font-semibold">Room {r.roomNumber}</span>
              <span className="ml-2 text-xs text-slate-500">{label(r.type)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 gap-2">
            <Link href="/bookings/new">
              <Button className="whitespace-nowrap">
                <CalendarPlus className="h-5 w-5" />
                <span className="hidden sm:inline">New booking</span>
              </Button>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
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
