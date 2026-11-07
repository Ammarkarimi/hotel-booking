"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  DoorOpen,
  LogIn,
  LogOut,
  Send,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Loading, StatCard, StatusBadge } from "@/components/ui";
import { PathikButton } from "@/components/pathik";
import { useApp } from "@/components/app-provider";
import { useBookingActions } from "@/components/booking-actions";
import { HandoverNotes } from "@/components/shift";
import { SendGuestFormDialog } from "@/components/guest-form-send";
import { api } from "@/lib/client";
import { cn, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { BookingDTO, CurrentShiftDTO, GuestFormDTO } from "@/lib/types";

interface DashboardRoom {
  id: string;
  roomNumber: string;
  type: string;
  floor: string | null;
  status: string;
  housekeeping: string;
  houseKeeperName: string | null;
  freeTonight: boolean;
  guestName: string | null;
  arrivingGuest: string | null;
}

interface Dashboard {
  today: string;
  hotelName: string;
  hasBookings: boolean; // the hotel has taken at least one booking, ever
  stats: {
    totalRooms: number;
    occupied: number;
    freeTonight: number;
    dirty: number;
    maintenance: number;
    occupancy: number;
    collectedToday: number;
    collectedByMethod: Record<string, number>;
    upcomingWeek: number;
    owed: number;
  };
  arrivals: BookingDTO[];
  departures: BookingDTO[];
  inHouse: BookingDTO[];
  unpaid: BookingDTO[];
  rooms: DashboardRoom[];
  activity: Array<{ id: string; staffName: string; action: string; details: string | null; createdAt: string }>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function BookingLine({ b, children, sub }: { b: BookingDTO; children?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/bookings/${b.id}`} className="min-w-0 hover:underline">
        <p className="truncate text-[15px] font-semibold text-slate-900">
          {b.guestName} {b.guest.vip && <Badge variant="purple">VIP</Badge>}
        </p>
        <p className="text-sm text-slate-500">
          Room {b.room.roomNumber} · #{b.number} {sub}
        </p>
      </Link>
      <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SetupChecklist({ data }: { data: Dashboard }) {
  const steps = [
    { done: data.hotelName !== "My Hotel", text: "Add your hotel name, address and tax details", href: "/settings" },
    { done: data.stats.totalRooms > 0, text: "Add your rooms and their prices", href: "/rooms" },
    { done: data.hasBookings, text: "Take your first booking", href: "/bookings/new" },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <Card className="border-primary-200 bg-primary-50/50">
      <CardHeader title="Getting started" description="Three quick steps to set up your hotel. It takes about 10 minutes." />
      <div className="divide-y divide-primary-100">
        {steps.map((s, i) => (
          <Link key={s.text} href={s.href} className="flex items-center gap-3 px-5 py-3 hover:bg-primary-50">
            {s.done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Circle className="h-6 w-6 text-primary-300" />}
            <span className={cn("flex-1 text-[15px] font-medium", s.done && "text-slate-400 line-through")}>
              Step {i + 1}: {s.text}
            </span>
            {!s.done && <ArrowRight className="h-5 w-5 text-primary-600" />}
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** Which floor a room is on: the floor typed in Rooms, or the first digit of a number like 204. */
function floorKey(r: DashboardRoom): string {
  const typed = r.floor?.trim();
  if (typed) return typed;
  return /^\d{3,4}$/.test(r.roomNumber) ? String(Math.floor(Number(r.roomNumber) / 100)) : "";
}

function floorName(key: string): string {
  if (key === "") return "Other rooms";
  if (key === "0" || /^g(round)?$/i.test(key)) return "Ground";
  return /^\d+$/.test(key) ? `Floor ${key}` : key;
}

const FLOOR_WORDS = ["ground", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/** Top floor first, like looking at the building from the street. Rooms without a floor go last. */
function floorRank(key: string): number {
  if (key === "") return -Infinity;
  const lower = key.toLowerCase();
  if (lower === "g" || lower.startsWith("ground")) return 0;
  const n = parseFloat(lower.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(n)) return n;
  const word = FLOOR_WORDS.findIndex((w) => lower.startsWith(w));
  return word >= 0 ? word : -1;
}

type TileState = "free" | "occupied" | "arriving" | "booked" | "maintenance";

// Lit windows have a guest in; plain windows are free; a yellow top edge means someone arrives today.
const TILE_STYLES: Record<TileState, string> = {
  occupied: "bg-lamp-400 text-primary-900",
  free: "bg-slate-50 text-primary-900",
  arriving: "bg-slate-50 text-primary-900 shadow-[inset_0_5px_0_var(--color-lamp-400)]",
  booked: "bg-primary-100 text-primary-900",
  maintenance: "bg-roof text-primary-300 ring-1 ring-inset ring-white/10",
};

function RoomBoard({ rooms, leavingToday }: { rooms: DashboardRoom[]; leavingToday: Set<string> }) {
  const router = useRouter();
  if (rooms.length === 0) return null;

  const floors = new Map<string, DashboardRoom[]>();
  for (const r of rooms) {
    const key = floorKey(r);
    floors.set(key, [...(floors.get(key) ?? []), r]);
  }
  const ordered = [...floors.entries()].sort((a, b) => floorRank(b[0]) - floorRank(a[0]));

  return (
    <section aria-labelledby="rooms-now" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rooms-now" className="text-xl font-bold text-slate-900">All rooms right now</h2>
          <p className="text-sm text-slate-500">Lit windows have a guest in. Tap a free room to book it, or any other room to open it.</p>
        </div>
        <Link href="/calendar" className="shrink-0">
          <Button variant="outline" size="sm">
            <CalendarDays className="h-4 w-4" /> Calendar
          </Button>
        </Link>
      </div>

      <div aria-hidden="true" className="mx-1 h-9 bg-roof [clip-path:polygon(3%_100%,50%_0,97%_100%)]" />
      <div className="space-y-3 bg-wall px-3 pb-4 pt-4 sm:px-5">
        {ordered.map(([key, list]) => (
          <div key={key || "none"} className="grid grid-cols-[52px_minmax(0,1fr)] items-stretch gap-2.5 sm:grid-cols-[72px_minmax(0,1fr)]">
            <p className="flex items-center text-xs font-bold text-primary-200 sm:text-sm">{floorName(key)}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
              {list.map((r) => {
                const state: TileState =
                  r.status === "maintenance" ? "maintenance" : r.guestName ? "occupied" : r.arrivingGuest ? "arriving" : r.freeTonight ? "free" : "booked";
                const text =
                  state === "maintenance" ? "Not usable" : state === "occupied" ? r.guestName : state === "arriving" ? `Arriving: ${r.arrivingGuest}` : state === "free" ? "Free tonight" : "Booked tonight";
                const needsCleaning = r.housekeeping !== "clean";
                const leaving = state === "occupied" && leavingToday.has(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => router.push(state === "free" ? `/bookings/new?room=${r.id}` : `/calendar?room=${r.id}`)}
                    className={cn(
                      "flex min-h-[104px] flex-col justify-end rounded-t-md rounded-b-sm px-2.5 pb-3 pt-2.5 text-left transition hover:ring-2 hover:ring-lamp-200",
                      TILE_STYLES[state],
                      needsCleaning && state !== "occupied" && state !== "maintenance" && "stripes",
                      leaving && "shadow-[inset_0_-6px_0_#d9541e]"
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-heading text-[22px] font-extrabold leading-none">{r.roomNumber}</span>
                      {needsCleaning && (
                        <span title={label(r.housekeeping)} className="rounded-full bg-white/85 p-1 text-red-700">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="sr-only">{label(r.housekeeping)}</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 truncate text-[13px] font-bold leading-tight">{text}</span>
                    <span className="truncate text-xs leading-tight opacity-80">{leaving ? "Leaves today" : label(r.type)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="h-2.5 rounded-b bg-slate-400" />

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-lamp-400" /> Guest staying</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm border border-slate-400 bg-slate-50" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm border border-slate-400 bg-slate-50 shadow-[inset_0_3px_0_var(--color-lamp-400)]" /> Arriving today</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-primary-100 ring-1 ring-primary-200" /> Booked tonight</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-lamp-400 shadow-[inset_0_-3px_0_#d9541e]" /> Leaves today</span>
        <span className="flex items-center gap-1.5"><span className="stripes h-3.5 w-3.5 rounded-sm" /> Needs cleaning</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-roof" /> Not usable</span>
      </div>
    </section>
  );
}

export default function TodayPage() {
  const { user, isAdmin, settings } = useApp();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [shifts, setShifts] = useState<CurrentShiftDTO | null>(null);
  const [forms, setForms] = useState<GuestFormDTO[]>([]);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(() => {
    api<Dashboard>("/api/dashboard")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
    api<CurrentShiftDTO>("/api/shifts/current").then(setShifts).catch(() => undefined);
    api<GuestFormDTO[]>("/api/guest-forms?view=received").then(setForms).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // keep the front desk screen fresh
    return () => clearInterval(t);
  }, [load]);

  const actions = useBookingActions(() => load());

  if (error && !data) return <EmptyState title="Could not load today's information" description={error} action={<Button onClick={load}>Try again</Button>} />;
  if (!data) return <Loading text="Loading today's information..." />;

  const { stats } = data;
  const stayingNotLeaving = data.inHouse.filter((b) => b.checkOutDate > data.today);
  const notInPathik = data.inHouse.filter((b) => !b.pathikAt);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-primary-600 sm:text-4xl">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {formatDate(data.today)}. Here is what needs your attention today.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 [&>button]:whitespace-nowrap">
          <Button size="lg" onClick={() => router.push("/bookings/new")}>
            <CalendarPlus className="h-5 w-5" /> New booking
          </Button>
          <Button size="lg" variant="success" onClick={() => router.push("/bookings/new?walkin=1")}>
            <UserPlus className="h-5 w-5" /> Walk-in guest
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push("/calendar")}>
            <CalendarDays className="h-5 w-5" /> Room calendar
          </Button>
          <Button size="lg" variant="outline" onClick={() => setSendOpen(true)}>
            <Send className="h-5 w-5" /> Send guest form
          </Button>
        </div>
      </div>
      <SendGuestFormDialog open={sendOpen} onClose={() => setSendOpen(false)} />

      {settings.pathik && notInPathik.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border-2 border-lamp-400 bg-lamp-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-lamp-900">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-lamp-700" />
            <span>
              <span className="block text-lg font-bold">
                {notInPathik.length} guest{notInPathik.length === 1 ? "" : "s"} still to enter in Pathik
              </span>
              <span className="block text-sm">
                {notInPathik
                  .slice(0, 4)
                  .map((b) => `${b.guestName} (Room ${b.room.roomNumber})`)
                  .join(", ")}
                {notInPathik.length > 4 ? ` and ${notInPathik.length - 4} more` : ""}
              </span>
            </span>
          </p>
          <Button variant="outline" className="shrink-0 border-lamp-400 bg-white" onClick={() => document.getElementById("pathik-left")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Fill them now
          </Button>
        </div>
      )}

      {forms.length > 0 && (
        <Card className="border-primary-200">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary-600" /> Guest forms: choose a room
              </span>
            }
            description="These guests filled in their details on WhatsApp"
            action={
              <Link href="/guest-forms" className="text-sm font-semibold text-primary-600 hover:underline">
                All forms
              </Link>
            }
          />
          <ul className="divide-y divide-slate-100">
            {forms.slice(0, 5).map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block font-semibold">{f.details ? `${f.details.firstName} ${f.details.lastName}`.trim() : f.phone}</span>
                  {f.details && (
                    <span className="block text-sm text-slate-500">
                      {formatDate(f.details.checkIn)} → {formatDate(f.details.checkOut)} · {f.details.adults + f.details.children} guest
                      {f.details.adults + f.details.children > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                <Link href={`/bookings/new?form=${f.id}`}>
                  <Button size="sm">
                    <BedDouble className="h-4 w-4" /> Choose room & book
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isAdmin && <SetupChecklist data={data} />}

      {shifts && shifts.handovers.length > 0 && (
        <Card>
          <CardHeader
            title="Handover notes"
            description="Left by staff at the end of their shift"
            action={
              isAdmin ? (
                <Link href="/shifts" className="text-sm font-semibold text-primary-600 hover:underline">
                  All shifts{shifts.unread ? ` (${shifts.unread} new)` : ""}
                </Link>
              ) : undefined
            }
          />
          <HandoverNotes notes={shifts.handovers} timeZone={settings.timezone} className="px-5 pb-5" />
        </Card>
      )}

      <div className={cn("grid gap-6", data.rooms.length > 0 && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
        <RoomBoard rooms={data.rooms} leavingToday={new Set(data.departures.map((b) => b.room.id))} />
        <div className={cn("grid content-start gap-3", data.rooms.length > 0 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-1" : "grid-cols-2 md:grid-cols-3 2xl:grid-cols-5")}>
          <StatCard title="Guests staying" value={`${stats.occupied} / ${stats.totalRooms - stats.maintenance}`} subtitle={`${stats.occupancy}% full tonight`} icon={<Users className="h-5 w-5" />} tone="sky" />
          <StatCard title="Free rooms tonight" value={stats.freeTonight} subtitle={stats.maintenance ? `${stats.maintenance} not usable` : "Ready to sell"} icon={<BedDouble className="h-5 w-5" />} tone="green" onClick={() => router.push("/bookings/new")} />
          <StatCard title="Rooms to clean" value={stats.dirty} subtitle="Tap to see list" icon={<Sparkles className="h-5 w-5" />} tone={stats.dirty ? "red" : "green"} onClick={() => router.push("/housekeeping")} />
          <StatCard
            title="Money received today"
            value={formatCurrency(stats.collectedToday)}
            subtitle={Object.entries(stats.collectedByMethod).map(([m, v]) => `${label(m)} ${formatCurrency(v)}`).join(" · ") || "No payments yet"}
            icon={<Wallet className="h-5 w-5" />}
            tone="primary"
            onClick={() => router.push("/payments")}
          />
          <StatCard title="Money to collect" value={formatCurrency(stats.owed)} subtitle="From guests staying or left" icon={<Wallet className="h-5 w-5" />} tone={stats.owed > 0 ? "amber" : "green"} onClick={() => router.push("/bookings?view=unpaid")} />
        </div>
      </div>

      {settings.pathik && notInPathik.length > 0 && (
        <Card className="scroll-mt-4 border-lamp-300" id="pathik-left">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-lamp-700" /> Not entered in Pathik yet ({notInPathik.length})
              </span>
            }
            description="Guests staying now who are not marked as entered in the police guest register."
          />
          {notInPathik.map((b) => (
            <BookingLine key={b.id} b={b}>
              <PathikButton bookingId={b.id} onChanged={load} />
            </BookingLine>
          ))}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-lamp-700" /> Arriving today ({data.arrivals.length})
              </span>
            }
            description="Guests expected to arrive. Press “Check in” when they reach the desk."
          />
          {data.arrivals.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No more arrivals today.</p>
          ) : (
            data.arrivals.map((b) => (
              <BookingLine
                key={b.id}
                b={b}
                sub={
                  <>
                    · {b.folio.nightCount} night{b.folio.nightCount === 1 ? "" : "s"}
                    {b.flags.lateArrival && <Badge variant="danger" className="ml-1">Was due {formatDate(b.checkInDate)}</Badge>}
                  </>
                }
              >
                <Button size="sm" variant="success" onClick={() => actions.checkIn(b)} loading={actions.busy === b.id}>
                  <LogIn className="h-4 w-4" /> Check in
                </Button>
                {b.flags.lateArrival && (
                  <Button size="sm" variant="outline" onClick={() => actions.noShow(b)}>
                    Did not come
                  </Button>
                )}
              </BookingLine>
            ))
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-primary-600" /> Leaving today ({data.departures.length})
              </span>
            }
            description="Collect any money due, then press “Check out”."
          />
          {data.departures.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No more check-outs today.</p>
          ) : (
            data.departures.map((b) => (
              <BookingLine
                key={b.id}
                b={b}
                sub={
                  <>
                    {b.folio.balance > 0.5 ? (
                      <span className="font-semibold text-red-600"> · owes {formatCurrency(b.folio.balance)}</span>
                    ) : (
                      <span className="text-emerald-600"> · fully paid</span>
                    )}
                    {b.flags.overstay && <Badge variant="danger" className="ml-1">Was due {formatDate(b.checkOutDate)}</Badge>}
                  </>
                }
              >
                <Button size="sm" onClick={() => actions.checkOut(b)}>
                  <DoorOpen className="h-4 w-4" /> Check out
                </Button>
              </BookingLine>
            ))
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Staying now (${stayingNotLeaving.length})`} description="Guests in the hotel who leave on a later day." />
          {stayingNotLeaving.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No other guests staying.</p>
          ) : (
            stayingNotLeaving.map((b) => (
              <BookingLine key={b.id} b={b} sub={<>· leaves {formatDate(b.checkOutDate)}</>}>
                {b.folio.balance > 0.5 && (
                  <Button size="sm" variant="outline" onClick={() => actions.takePayment(b)}>
                    Take payment
                  </Button>
                )}
              </BookingLine>
            ))
          )}
        </Card>

        <Card>
          <CardHeader
            title="Money still to collect"
            description="Guests who have not paid in full."
            action={
              <Link href="/bookings?view=unpaid" className="text-sm font-semibold text-primary-600 hover:underline">
                See all
              </Link>
            }
          />
          {data.unpaid.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">Everyone has paid. 🎉</p>
          ) : (
            data.unpaid.slice(0, 6).map((b) => (
              <BookingLine key={b.id} b={b} sub={<> · <StatusBadge status={b.status} /></>}>
                <span className="self-center text-[15px] font-bold text-red-600">{formatCurrency(b.folio.balance)}</span>
                <Button size="sm" variant="success" onClick={() => actions.takePayment(b)}>
                  Take payment
                </Button>
              </BookingLine>
            ))
          )}
        </Card>
      </div>

      {isAdmin && data.activity.length > 0 && (
        <Card>
          <CardHeader
            title="Recent activity"
            description="Who did what, most recent first."
            action={
              <Link href="/settings?tab=activity" className="text-sm font-semibold text-primary-600 hover:underline">
                Full history
              </Link>
            }
          />
          <ul className="divide-y divide-slate-100">
            {data.activity.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 px-5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <b>{a.staffName}</b> — {a.action}
                  {a.details && <span className="text-slate-500">: {a.details}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.upcomingWeek > 0 && (
        <p className="text-center text-sm text-slate-500">
          {stats.upcomingWeek} more booking{stats.upcomingWeek === 1 ? "" : "s"} arriving in the next 7 days.{" "}
          <Link href="/bookings?view=upcoming" className="font-semibold text-primary-600 hover:underline">
            View upcoming
          </Link>
        </p>
      )}

      {actions.dialogs}
    </div>
  );
}
