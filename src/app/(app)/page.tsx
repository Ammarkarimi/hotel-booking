"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Loading, StatusBadge } from "@/components/ui";
import { PathikButton } from "@/components/pathik";
import { useApp } from "@/components/app-provider";
import { useBookingActions } from "@/components/booking-actions";
import { HandoverNotes } from "@/components/shift";
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
  priceTonight: number;
  freeTonight: boolean;
  guestName: string | null;
  arrivingGuest: string | null;
}

interface Dashboard {
  today: string;
  hotelName: string;
  offlineSavedAt?: string; // set when there is no internet and this is the copy saved on this computer
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

// Table cells used on this page, the same everywhere so the screen reads like one sheet.
const TH = "border-b border-slate-300 bg-slate-50 px-2 py-1 text-left text-xs font-bold text-slate-600 whitespace-nowrap";
const TD = "border-b border-slate-200 px-2 py-1.5 align-middle text-[13px]";
const EMPTY = "px-2 py-4 text-center text-[13px] text-slate-500";

/** "9 Nov" from a date key. */
function shortDate(key: string) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function GuestCell({ b }: { b: BookingDTO }) {
  return (
    <Link href={`/bookings/${b.id}`} className="font-semibold text-primary-700 hover:underline">
      {b.guestName}
      {b.guest.vip && (
        <Badge variant="purple" className="ml-1.5">
          VIP
        </Badge>
      )}
    </Link>
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
    <Card>
      <CardHeader title="Getting started" description="Three quick steps to set up your hotel. It takes about 10 minutes." />
      <ul>
        {steps.map((s, i) => (
          <li key={s.text} className="border-b border-slate-200 last:border-0">
            <Link href={s.href} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-primary-50">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Circle className="h-4 w-4 text-slate-400" />}
              <span className={cn("flex-1", s.done ? "text-slate-400 line-through" : "font-semibold text-primary-700 underline")}>
                Step {i + 1}: {s.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The day's numbers in one strip. Each opens the matching screen. */
function Figures({ data }: { data: Dashboard }) {
  const router = useRouter();
  const { stats } = data;
  const byMethod = Object.entries(stats.collectedByMethod)
    .map(([m, v]) => `${label(m)} ${formatCurrency(v)}`)
    .join(", ");
  const cells: Array<{ title: string; value: string; sub: string; href?: string; tone?: string }> = [
    { title: "Guests staying", value: `${stats.occupied} / ${stats.totalRooms - stats.maintenance}`, sub: `${stats.occupancy}% full tonight` },
    { title: "Free rooms tonight", value: String(stats.freeTonight), sub: stats.maintenance ? `${stats.maintenance} not usable` : "Ready to sell", href: "/bookings/new" },
    { title: "Rooms to clean", value: String(stats.dirty), sub: "Open housekeeping", href: "/housekeeping", tone: stats.dirty ? "text-red-700" : undefined },
    { title: "Money received today", value: formatCurrency(stats.collectedToday), sub: byMethod || "No payments yet", href: "/payments" },
    { title: "Money to collect", value: formatCurrency(stats.owed), sub: "From guests staying or left", href: "/bookings?view=unpaid", tone: stats.owed > 0 ? "text-red-700" : undefined },
  ];
  return (
    <div className="grid grid-cols-2 border-l border-t border-chrome-line bg-white sm:grid-cols-3 xl:grid-cols-5">
      {cells.map((c) => {
        const body = (
          <>
            <span className="block text-xs font-semibold text-slate-600">{c.title}</span>
            <span className={cn("block text-lg font-bold tabular-nums text-slate-900", c.tone)}>{c.value}</span>
            <span className="block truncate text-xs text-slate-500">{c.sub}</span>
          </>
        );
        const cls = "border-b border-r border-chrome-line px-3 py-1.5 text-left";
        return c.href ? (
          <button key={c.title} onClick={() => router.push(c.href!)} className={cn(cls, "hover:bg-primary-50")}>
            {body}
          </button>
        ) : (
          <div key={c.title} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Every room as a small box: grey when a guest is in tonight, white when not. */
/** How many rooms of each category are still free tonight, and tonight's price. */
function FreeByCategory({ rooms }: { rooms: DashboardRoom[] }) {
  const rows = new Map<string, { type: string; total: number; free: number; ready: number; prices: number[] }>();
  for (const r of rooms) {
    const row = rows.get(r.type) ?? { type: r.type, total: 0, free: 0, ready: 0, prices: [] };
    row.total += 1;
    if (r.freeTonight) {
      row.free += 1;
      if (r.housekeeping === "clean") row.ready += 1;
      row.prices.push(r.priceTonight);
    }
    rows.set(r.type, row);
  }
  const list = [...rows.values()].sort((a, b) => Math.min(...a.prices, Infinity) - Math.min(...b.prices, Infinity) || a.type.localeCompare(b.type));
  const free = list.reduce((s, r) => s + r.free, 0);
  const price = (prices: number[]) => {
    if (prices.length === 0) return "";
    const low = Math.min(...prices);
    return low === Math.max(...prices) ? formatCurrency(low) : `from ${formatCurrency(low)}`;
  };
  return (
    <div className="border-t border-slate-200 lg:border-l lg:border-t-0">
      <table className="w-full">
        <thead>
          <tr>
            <th className={TH}>Free tonight</th>
            <th className={cn(TH, "text-right")}>Rooms</th>
            <th className={cn(TH, "text-right")}>Price</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.type} className={r.free === 0 ? "text-slate-400" : undefined}>
              <td className={TD}>
                <span className={r.free === 0 ? "" : "font-semibold text-slate-900"}>{label(r.type)}</span>
                {r.free > r.ready && <span className="block text-xs text-red-700">{r.free - r.ready} need{r.free - r.ready === 1 ? "s" : ""} cleaning</span>}
              </td>
              <td className={cn(TD, "whitespace-nowrap text-right")}>
                <b className={r.free === 0 ? "" : "text-slate-900"}>{r.free}</b> of {r.total}
              </td>
              <td className={cn(TD, "whitespace-nowrap text-right")}>{r.free === 0 ? "Full" : price(r.prices)}</td>
            </tr>
          ))}
          <tr>
            <td className={cn(TD, "font-bold")}>All rooms</td>
            <td className={cn(TD, "whitespace-nowrap text-right")}>
              <b>{free}</b> of {rooms.length}
            </td>
            <td className={TD} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoomsTonight({ data }: { data: Dashboard }) {
  const router = useRouter();
  const { settings } = useApp();
  if (data.rooms.length === 0) return null;
  const staying = new Map(data.inHouse.map((b) => [b.room.id, b]));
  const leaving = new Set(data.departures.map((b) => b.room.id));

  return (
    <Card>
      <CardHeader
        title="Rooms tonight"
        description="Click a free room to book it, or any other room to see it in the calendar."
        action={
          <Link href="/calendar" className="text-[13px] font-semibold text-primary-700 underline">
            Calendar
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid content-start grid-cols-2 gap-2 p-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {data.rooms.map((r) => {
          const dirty = r.housekeeping !== "clean";
          const booking = staying.get(r.id);
          let state: string;
          let line: React.ReactNode;
          if (r.status === "maintenance") {
            state = "Not usable";
            line = "Cannot be booked";
          } else if (r.guestName) {
            state = firstName(r.guestName);
            line = leaving.has(r.id) ? "Leaves today" : booking ? `Till ${shortDate(booking.checkOutDate)}` : label(r.type);
          } else if (r.arrivingGuest) {
            state = "Arriving";
            line = firstName(r.arrivingGuest);
          } else if (r.freeTonight) {
            state = "Free";
            line = dirty ? <span className="text-red-700">Needs cleaning</span> : <span className="text-emerald-700">Ready</span>;
          } else {
            state = "Booked";
            line = "Guest not in yet";
          }
          const occupied = !!r.guestName && r.status !== "maintenance";
          return (
            <button
              key={r.id}
              onClick={() => router.push(r.status !== "maintenance" && !r.guestName && !r.arrivingGuest && r.freeTonight ? `/bookings/new?room=${r.id}` : `/calendar?room=${r.id}`)}
              title={`Room ${r.roomNumber}, ${label(r.type)}${dirty ? `, ${label(r.housekeeping)}` : ""}`}
              className={cn(
                "border border-slate-300 px-2.5 py-1.5 text-left text-[13px] leading-snug hover:border-primary-500",
                occupied ? "bg-slate-100" : "bg-white",
                r.status === "maintenance" && "text-slate-400"
              )}
            >
              <span className="block truncate">
                <b className={r.status === "maintenance" ? "" : "text-slate-900"}>{r.roomNumber}</b> {state}
              </span>
              <span className={cn("block truncate", r.status === "maintenance" ? "" : "text-slate-500")}>{line}</span>
              {occupied && dirty && <span className="block truncate text-red-700">Needs cleaning</span>}
              <span className={cn("mt-0.5 flex justify-between gap-2 border-t border-slate-200 pt-0.5 text-xs", r.status === "maintenance" ? "" : "text-slate-600")}>
                <span className="truncate">{label(r.type)}</span>
                <span className="shrink-0 font-semibold">{formatCurrency(r.priceTonight)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <FreeByCategory rooms={data.rooms} />
      </div>
      <p className="border-t border-slate-200 px-3 py-1 text-xs text-slate-500">Grey: guest in. White: no guest tonight. Prices are for tonight, {settings.roomPricesIncludeTax ? "GST included" : "before GST"}.</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { isAdmin, settings, has } = useApp();
  const shiftsOn = has("shifts");
  const formsOn = has("guest_forms");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [shifts, setShifts] = useState<CurrentShiftDTO | null>(null);
  const [forms, setForms] = useState<GuestFormDTO[]>([]);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    api<Dashboard>("/api/dashboard")
      .then((d) => {
        setData(d);
        setError("");
        setLoadedAt(new Date());
      })
      .catch((e) => setError(e.message));
    if (shiftsOn) api<CurrentShiftDTO>("/api/shifts/current").then(setShifts).catch(() => undefined);
    if (formsOn) api<GuestFormDTO[]>("/api/guest-forms?view=received").then(setForms).catch(() => undefined);
  }, [shiftsOn, formsOn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // keep the front desk screen fresh
    return () => clearInterval(t);
  }, [load]);

  // Guests who paid through a Razorpay link and closed the page: their payments are added here.
  const onlineOn = settings.onlinePayments;
  useEffect(() => {
    if (!onlineOn) return;
    const check = () =>
      api<{ recorded: number }>("/api/payments/online", { method: "POST" })
        .then((r) => r.recorded > 0 && load())
        .catch(() => undefined);
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => clearInterval(t);
  }, [onlineOn, load]);

  const actions = useBookingActions(() => load());

  if (error && !data) return <EmptyState title="Could not load today's information" description={error} action={<Button onClick={load}>Try again</Button>} />;
  if (!data) return <Loading text="Loading today's information..." />;

  const stayingNotLeaving = data.inHouse.filter((b) => b.checkOutDate > data.today);
  const notInPathik = data.inHouse.filter((b) => !b.pathikAt);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-chrome-line pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-[13px] text-slate-600">{formatDate(data.today)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/print/day-sheet" target="_blank" title="Print each morning, or send on WhatsApp, in case the power or internet goes">
            <Button size="sm" variant="outline">
              <FileText className="h-4 w-4" /> Day sheet
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={load} title="Updates by itself every minute">
            <RefreshCw className="h-4 w-4" /> Refresh
            {loadedAt && <span className="text-xs font-normal text-slate-500">{loadedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
          </Button>
        </div>
      </div>

      {data.offlineSavedAt && (
        <div role="alert" className="border border-amber-400 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          <b>Cannot reach the server.</b> This is the copy saved on this computer at {formatDateTime(data.offlineSavedAt)}; anything entered after that is not shown. Write check-ins, check-outs and payments on the{" "}
          <a href="/print/day-sheet" target="_blank" className="font-semibold underline">
            Day sheet
          </a>{" "}
          and enter them when the internet is back.
        </div>
      )}

      {settings.pathik && notInPathik.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 border border-amber-400 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <b>
              Pathik: {notInPathik.length} guest{notInPathik.length === 1 ? "" : "s"} not entered yet.
            </b>{" "}
            {notInPathik
              .slice(0, 4)
              .map((b) => `${b.guestName} (Room ${b.room.roomNumber})`)
              .join(", ")}
            {notInPathik.length > 4 ? ` and ${notInPathik.length - 4} more` : ""}
          </p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => document.getElementById("pathik-left")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Fill them now
          </Button>
        </div>
      )}

      <Figures data={data} />

      {forms.length > 0 && (
        <Card>
          <CardHeader
            title={`Express check-in: choose a room (${forms.length})`}
            description="These guests filled in their details on WhatsApp"
            action={
              <Link href="/guest-forms" className="text-[13px] font-semibold text-primary-700 underline">
                All express check-ins
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Dates</th>
                  <th className={TH}>Guests</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {forms.slice(0, 5).map((f) => (
                  <tr key={f.id}>
                    <td className={cn(TD, "font-semibold")}>{f.details ? `${f.details.firstName} ${f.details.lastName}`.trim() : f.phone}</td>
                    <td className={TD}>{f.details ? `${formatDate(f.details.checkIn)} to ${formatDate(f.details.checkOut)}` : ""}</td>
                    <td className={TD}>{f.details ? f.details.adults + f.details.children : ""}</td>
                    <td className={cn(TD, "text-right")}>
                      <Link href={`/bookings/new?form=${f.id}`}>
                        <Button size="sm">Choose room and book</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <Link href="/shifts" className="text-[13px] font-semibold text-primary-700 underline">
                  All shifts{shifts.unread ? ` (${shifts.unread} new)` : ""}
                </Link>
              ) : undefined
            }
          />
          <HandoverNotes notes={shifts.handovers} timeZone={settings.timezone} className="p-2" />
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Arriving today (${data.arrivals.length})`} description="Press Check in when the guest reaches the desk." />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>No.</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Room</th>
                  <th className={TH}>Nights</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {data.arrivals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={EMPTY}>
                      No more arrivals today.
                    </td>
                  </tr>
                ) : (
                  data.arrivals.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(TD, "text-slate-500")}>{b.number}</td>
                      <td className={TD}>
                        <GuestCell b={b} />
                        {b.flags.lateArrival && (
                          <Badge variant="danger" className="ml-1.5">
                            Was due {formatDate(b.checkInDate)}
                          </Badge>
                        )}
                      </td>
                      <td className={TD}>{b.room.roomNumber}</td>
                      <td className={TD}>{b.folio.nightCount}</td>
                      <td className={cn(TD, "whitespace-nowrap text-right")}>
                        <span className="inline-flex gap-1.5">
                          {b.flags.lateArrival && (
                            <Button size="sm" variant="outline" onClick={() => actions.noShow(b)}>
                              Did not come
                            </Button>
                          )}
                          <Button size="sm" variant="success" onClick={() => actions.checkIn(b)} loading={actions.busy === b.id}>
                            Check in
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Leaving today (${data.departures.length})`} description="Collect any money due, then press Check out." />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>No.</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Room</th>
                  <th className={cn(TH, "text-right")}>Balance</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {data.departures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={EMPTY}>
                      No more check-outs today.
                    </td>
                  </tr>
                ) : (
                  data.departures.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(TD, "text-slate-500")}>{b.number}</td>
                      <td className={TD}>
                        <GuestCell b={b} />
                        {b.flags.overstay && (
                          <Badge variant="danger" className="ml-1.5">
                            Was due {formatDate(b.checkOutDate)}
                          </Badge>
                        )}
                      </td>
                      <td className={TD}>{b.room.roomNumber}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>
                        {b.folio.balance > 0.5 ? <b className="text-red-700">{formatCurrency(b.folio.balance)}</b> : <span className="text-emerald-700">Paid</span>}
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <Button size="sm" onClick={() => actions.checkOut(b)}>
                          Check out
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <RoomsTonight data={data} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Staying now (${stayingNotLeaving.length})`} description="Guests in the hotel who leave on a later day." />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>No.</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Room</th>
                  <th className={TH}>Leaves</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {stayingNotLeaving.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={EMPTY}>
                      No other guests staying.
                    </td>
                  </tr>
                ) : (
                  stayingNotLeaving.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(TD, "text-slate-500")}>{b.number}</td>
                      <td className={TD}>
                        <GuestCell b={b} />
                      </td>
                      <td className={TD}>{b.room.roomNumber}</td>
                      <td className={TD}>{formatDate(b.checkOutDate)}</td>
                      <td className={cn(TD, "text-right")}>
                        {b.folio.balance > 0.5 && (
                          <Button size="sm" variant="outline" onClick={() => actions.takePayment(b)}>
                            Take payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Money still to collect"
            description="Guests who have not paid in full."
            action={
              <Link href="/bookings?view=unpaid" className="text-[13px] font-semibold text-primary-700 underline">
                See all
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>No.</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Room</th>
                  <th className={TH}>Status</th>
                  <th className={cn(TH, "text-right")}>Due</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {data.unpaid.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={EMPTY}>
                      Everyone has paid.
                    </td>
                  </tr>
                ) : (
                  data.unpaid.slice(0, 6).map((b) => (
                    <tr key={b.id}>
                      <td className={cn(TD, "text-slate-500")}>{b.number}</td>
                      <td className={TD}>
                        <GuestCell b={b} />
                      </td>
                      <td className={TD}>{b.room.roomNumber}</td>
                      <td className={TD}>
                        <StatusBadge status={b.status} />
                      </td>
                      <td className={cn(TD, "text-right font-bold tabular-nums text-red-700")}>{formatCurrency(b.folio.balance)}</td>
                      <td className={cn(TD, "text-right")}>
                        <Button size="sm" variant="success" onClick={() => actions.takePayment(b)}>
                          Take payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {settings.pathik && notInPathik.length > 0 && (
        <Card className="scroll-mt-14" id="pathik-left">
          <CardHeader title={`Not entered in Pathik yet (${notInPathik.length})`} description="Guests staying now who are not marked as entered in the police guest register." />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>No.</th>
                  <th className={TH}>Guest</th>
                  <th className={TH}>Room</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {notInPathik.map((b) => (
                  <tr key={b.id}>
                    <td className={cn(TD, "text-slate-500")}>{b.number}</td>
                    <td className={TD}>
                      <GuestCell b={b} />
                    </td>
                    <td className={TD}>{b.room.roomNumber}</td>
                    <td className={cn(TD, "text-right")}>
                      <PathikButton bookingId={b.id} onChanged={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isAdmin && data.activity.length > 0 && (
        <Card>
          <CardHeader
            title="Recent activity"
            description="Who did what, most recent first."
            action={
              <Link href="/settings?tab=activity" className="text-[13px] font-semibold text-primary-700 underline">
                Full history
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Time</th>
                  <th className={TH}>Staff</th>
                  <th className={TH}>What they did</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.map((a) => (
                  <tr key={a.id}>
                    <td className={cn(TD, "whitespace-nowrap text-slate-500")}>{formatDateTime(a.createdAt)}</td>
                    <td className={cn(TD, "whitespace-nowrap font-semibold")}>{a.staffName}</td>
                    <td className={TD}>
                      {a.action}
                      {a.details && <span className="text-slate-500">: {a.details}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.stats.upcomingWeek > 0 && (
        <p className="text-[13px] text-slate-600">
          {data.stats.upcomingWeek} more booking{data.stats.upcomingWeek === 1 ? "" : "s"} arriving in the next 7 days.{" "}
          <Link href="/bookings?view=upcoming" className="font-semibold text-primary-700 underline">
            View upcoming
          </Link>
        </p>
      )}

      {actions.dialogs}
    </div>
  );
}
