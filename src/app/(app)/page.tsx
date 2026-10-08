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
  DoorOpen,
  LogIn,
  LogOut,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Loading, StatCard, StatusBadge } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { useBookingActions } from "@/components/booking-actions";
import { api } from "@/lib/client";
import { cn, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { BookingDTO } from "@/lib/types";

interface DashboardRoom {
  id: string;
  roomNumber: string;
  type: string;
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
    { done: data.inHouse.length + data.arrivals.length > 0, text: "Take your first booking", href: "/bookings/new" },
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

const TILE_STYLES: Record<string, string> = {
  free: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400",
  occupied: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400",
  arriving: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400",
  booked: "border-amber-200 bg-amber-50/60 text-amber-900 hover:border-amber-400",
  maintenance: "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-400",
};

function RoomBoard({ rooms }: { rooms: DashboardRoom[] }) {
  const router = useRouter();
  if (rooms.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="All rooms right now"
        description="Tap a room: free rooms open a new booking, others open the guest's booking."
        action={
          <Link href="/calendar">
            <Button variant="outline" size="sm">
              <CalendarDays className="h-4 w-4" /> Calendar
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {rooms.map((r) => {
          const state =
            r.status === "maintenance" ? "maintenance" : r.guestName ? "occupied" : r.arrivingGuest ? "arriving" : r.freeTonight ? "free" : "booked";
          const text =
            state === "maintenance" ? "Not usable" : state === "occupied" ? r.guestName : state === "arriving" ? `Arriving: ${r.arrivingGuest}` : state === "free" ? "Free tonight" : "Booked tonight";
          return (
            <button
              key={r.id}
              onClick={() => router.push(state === "free" ? `/bookings/new?room=${r.id}` : `/calendar?room=${r.id}`)}
              className={cn("rounded-xl border-2 p-3 text-left transition", TILE_STYLES[state])}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{r.roomNumber}</span>
                {r.housekeeping !== "clean" && (
                  <span title={label(r.housekeeping)} className="rounded-full bg-white/80 p-1 text-red-600">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <p className="text-xs font-medium opacity-80">{label(r.type)}</p>
              <p className="mt-1 truncate text-sm font-semibold">{text}</p>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-300" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-300" /> Guest staying</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300" /> Arriving / booked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-300" /> Not usable</span>
        <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-red-600" /> Needs cleaning</span>
      </div>
    </Card>
  );
}

export default function TodayPage() {
  const { user, isAdmin } = useApp();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Dashboard>("/api/dashboard")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {formatDate(data.today)} · Here is what needs your attention today.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button size="lg" onClick={() => router.push("/bookings/new")}>
            <CalendarPlus className="h-5 w-5" /> New booking
          </Button>
          <Button size="lg" variant="success" onClick={() => router.push("/bookings/new?walkin=1")}>
            <UserPlus className="h-5 w-5" /> Walk-in guest
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push("/calendar")}>
            <CalendarDays className="h-5 w-5" /> Room calendar
          </Button>
        </div>
      </div>

      {isAdmin && <SetupChecklist data={data} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-amber-600" /> Arriving today ({data.arrivals.length})
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

      <RoomBoard rooms={data.rooms} />

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
