"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Wrench } from "lucide-react";
import { Button, Card, EmptyState, Input, Loading, PageHeader } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays, dateFromKey, diffDays } from "@/lib/dates";
import { cn, formatCurrency, label } from "@/lib/utils";

interface CalendarData {
  start: string;
  days: number;
  today: string;
  rooms: Array<{ id: string; roomNumber: string; type: string; status: string; housekeeping: string; pricePerNight: number }>;
  bookings: Array<{ id: string; number: number; roomId: string; status: string; checkIn: string; checkOut: string; guestName: string; source: string }>;
}

const BAR_COLORS: Record<string, string> = {
  reserved: "bg-amber-400 hover:bg-amber-500 text-amber-950",
  checked_in: "bg-sky-500 hover:bg-sky-600 text-white",
  checked_out: "bg-slate-300 hover:bg-slate-400 text-slate-700",
};

function dayLabel(key: string) {
  const d = dateFromKey(key);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    day: d.getUTCDate(),
    month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
    weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
}

function CalendarView() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings } = useApp();
  const highlight = params.get("room");
  const [days, setDays] = useState(14);
  const [start, setStart] = useState(addDays(settings.today, -1));
  const [data, setData] = useState<CalendarData | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setDays(mq.matches ? 7 : 14);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    api<CalendarData>(`/api/calendar?start=${start}&days=${days}`).then(setData).catch(() => undefined);
  }, [start, days]);

  const dayKeys = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const freeCount = useMemo(() => {
    if (!data) return {};
    const counts: Record<string, number> = {};
    for (const d of dayKeys) {
      const busy = new Set(data.bookings.filter((b) => b.status !== "checked_out" && b.checkIn <= d && b.checkOut > d).map((b) => b.roomId));
      counts[d] = data.rooms.filter((r) => r.status !== "maintenance" && !busy.has(r.id)).length;
    }
    return counts;
  }, [data, dayKeys]);

  const gridCols = { gridTemplateColumns: `minmax(92px, 120px) repeat(${days}, minmax(52px, 1fr))` };

  return (
    <div>
      <PageHeader
        title="Room Calendar"
        description="See which rooms are free on any date. Tap an empty box to book that room, or a coloured bar to open the booking."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
          <ChevronLeft className="h-5 w-5" /> <span className="hidden sm:inline">Earlier</span>
        </Button>
        <Button variant="outline" onClick={() => setStart(addDays(settings.today, -1))}>
          Today
        </Button>
        <Button variant="outline" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
          <span className="hidden sm:inline">Later</span> <ChevronRight className="h-5 w-5" />
        </Button>
        <Input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="w-auto" aria-label="Start date" />
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-amber-400" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-sky-500" /> Staying</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-slate-300" /> Left</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-emerald-400 bg-emerald-50" /> Free</span>
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : data.rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description="Add your rooms first, then they will show on the calendar." action={<Button onClick={() => router.push("/rooms")}>Add rooms</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-max">
            <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={gridCols}>
              <div className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-500">Room</div>
              {dayKeys.map((d) => {
                const l = dayLabel(d);
                return (
                  <div key={d} className={cn("border-l border-slate-100 px-1 py-2 text-center", d === data.today && "bg-primary-50", l.weekend && d !== data.today && "bg-slate-50")}>
                    <p className={cn("text-[11px] font-semibold uppercase", d === data.today ? "text-primary-700" : "text-slate-500")}>{d === data.today ? "Today" : l.weekday}</p>
                    <p className={cn("text-base font-bold", d === data.today && "text-primary-700")}>{l.day}</p>
                    <p className="text-[10px] text-slate-400">{l.month}</p>
                    <p className={cn("mt-0.5 text-[10px] font-semibold", freeCount[d] ? "text-emerald-600" : "text-red-500")}>{freeCount[d] ?? 0} free</p>
                  </div>
                );
              })}
            </div>

            {data.rooms.map((room) => {
              const roomBookings = data.bookings.filter((b) => b.roomId === room.id && b.checkOut > start && b.checkIn < addDays(start, days));
              return (
                <div key={room.id} className={cn("grid border-b border-slate-100", highlight === room.id && "bg-primary-50/40")} style={gridCols}>
                  <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-slate-100 bg-white px-3 py-2" style={{ gridRow: 1, gridColumn: 1 }}>
                    <p className="flex items-center gap-1 text-base font-bold">
                      {room.roomNumber}
                      {room.housekeeping !== "clean" && <Sparkles className="h-3.5 w-3.5 text-red-500" aria-label={label(room.housekeeping)} />}
                      {room.status === "maintenance" && <Wrench className="h-3.5 w-3.5 text-orange-500" aria-label="Not usable" />}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {label(room.type)} · {formatCurrency(room.pricePerNight)}
                    </p>
                  </div>
                  {dayKeys.map((d, i) => (
                    <button
                      key={d}
                      style={{ gridRow: 1, gridColumn: i + 2 }}
                      disabled={room.status === "maintenance" || d < data.today}
                      onClick={() => router.push(`/bookings/new?room=${room.id}&checkIn=${d}&checkOut=${addDays(d, 1)}`)}
                      title={room.status === "maintenance" ? "Not usable" : `Book room ${room.roomNumber} from ${d}`}
                      className={cn(
                        "h-14 border-l border-slate-100 transition",
                        room.status === "maintenance"
                          ? "cursor-not-allowed bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)]"
                          : d < data.today
                            ? "cursor-default bg-slate-50/60"
                            : "hover:bg-emerald-50",
                        d === data.today && room.status !== "maintenance" && "bg-primary-50/50"
                      )}
                    />
                  ))}
                  {roomBookings.map((b) => {
                    const from = Math.max(0, diffDays(start, b.checkIn));
                    const to = Math.min(days, diffDays(start, b.checkOut));
                    if (to <= from) return null;
                    const startsBefore = b.checkIn < start;
                    const endsAfter = diffDays(start, b.checkOut) > days;
                    return (
                      <button
                        key={b.id}
                        onClick={() => router.push(`/bookings/${b.id}`)}
                        style={{ gridRow: 1, gridColumn: `${from + 2} / span ${to - from}` }}
                        title={`#${b.number} ${b.guestName} (${label(b.status)}) ${b.checkIn} → ${b.checkOut}`}
                        className={cn(
                          "relative z-[1] mx-0.5 my-2 flex items-center overflow-hidden px-2 text-left text-xs font-semibold shadow-sm transition",
                          BAR_COLORS[b.status] || BAR_COLORS.reserved,
                          startsBefore ? "rounded-l-none" : "rounded-l-lg",
                          endsAfter ? "rounded-r-none" : "rounded-r-lg"
                        )}
                      >
                        <span className="truncate">{b.guestName}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CalendarView />
    </Suspense>
  );
}
