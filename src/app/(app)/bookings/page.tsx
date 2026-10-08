"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CalendarPlus, ClipboardList, DoorOpen, LogIn, Search, Wallet } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Loading, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { useBookingActions } from "@/components/booking-actions";
import { api } from "@/lib/client";
import { paymentState } from "@/lib/pricing";
import { formatCurrency, formatDate, label } from "@/lib/utils";
import type { BookingDTO } from "@/lib/types";

type View = "upcoming" | "in_house" | "past" | "unpaid" | "all";

const VIEWS: Array<{ value: View; label: string; help: string }> = [
  { value: "upcoming", label: "Coming", help: "Booked guests who have not arrived yet" },
  { value: "in_house", label: "Staying now", help: "Guests currently in the hotel" },
  { value: "unpaid", label: "Not fully paid", help: "Guests who still owe money" },
  { value: "past", label: "Past & cancelled", help: "Guests who left, cancelled or did not come" },
  { value: "all", label: "All", help: "Every booking" },
];

function BookingsList() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>((params.get("view") as View) || "upcoming");
  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (view !== "all") qs.set("view", view);
    if (q.trim()) qs.set("q", q.trim());
    api<BookingDTO[]>(`/api/bookings?${qs}`)
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [view, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const actions = useBookingActions(() => load());

  function changeView(v: View) {
    setView(v);
    setBookings(null);
    router.replace(`/bookings?view=${v}`);
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={VIEWS.find((v) => v.value === view)?.help}
        actions={
          <Link href="/bookings/new">
            <Button>
              <CalendarPlus className="h-5 w-5" /> New booking
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={VIEWS} value={view} onChange={changeView} />
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Guest name, phone, booking # or room" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {bookings === null ? (
        <Loading />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={q ? "No bookings match your search" : "No bookings here"}
          description={view === "upcoming" ? "New bookings you make will appear here until the guest arrives." : undefined}
          action={
            <Link href="/bookings/new">
              <Button>New booking</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
            <span className="col-span-3">Guest</span>
            <span className="col-span-1">Room</span>
            <span className="col-span-3">Dates</span>
            <span className="col-span-2 text-right">Bill</span>
            <span className="col-span-3 text-right">Action</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {bookings.map((b) => {
              const ps = paymentState(b.folio.grandTotal, b.folio.netPaid);
              const active = b.status !== "cancelled" && b.status !== "no_show";
              return (
                <li key={b.id} className="grid grid-cols-1 gap-2 px-5 py-3 hover:bg-slate-50/60 md:grid-cols-12 md:items-center md:gap-3">
                  <Link href={`/bookings/${b.id}`} className="col-span-3 min-w-0">
                    <p className="truncate font-semibold text-slate-900 hover:underline">
                      {b.guestName} {b.guest.vip && <Badge variant="purple">VIP</Badge>}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      #{b.number} · {label(b.source)} <StatusBadge status={b.status} />
                    </p>
                  </Link>
                  <div className="col-span-1 text-[15px] font-semibold">
                    <span className="md:hidden text-slate-500 font-normal">Room </span>
                    {b.room.roomNumber}
                  </div>
                  <div className="col-span-3 text-sm text-slate-600">
                    {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                    <span className="text-slate-400"> · {b.folio.nightCount}n</span>
                    {b.flags.arrivingToday && <Badge variant="warning" className="ml-1">Today</Badge>}
                    {b.flags.leavingToday && <Badge variant="info" className="ml-1">Leaves today</Badge>}
                    {b.flags.overstay && <Badge variant="danger" className="ml-1">Overdue</Badge>}
                  </div>
                  <div className="col-span-2 text-sm md:text-right">
                    <p className="font-semibold">{formatCurrency(b.folio.grandTotal)}</p>
                    {active && b.folio.balance > 0.5 ? <p className="text-xs font-semibold text-red-600">owes {formatCurrency(b.folio.balance)}</p> : active && <Badge variant={ps}>{label(ps)}</Badge>}
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-2 md:justify-end">
                    {(b.flags.arrivingToday || b.flags.lateArrival) && (
                      <Button size="sm" variant="success" onClick={() => actions.checkIn(b)} loading={actions.busy === b.id}>
                        <LogIn className="h-4 w-4" /> Check in
                      </Button>
                    )}
                    {b.status === "checked_in" && (
                      <Button size="sm" onClick={() => actions.checkOut(b)}>
                        <DoorOpen className="h-4 w-4" /> Check out
                      </Button>
                    )}
                    {active && b.folio.balance > 0.5 && b.status !== "reserved" && (
                      <Button size="sm" variant="outline" onClick={() => actions.takePayment(b)}>
                        <Wallet className="h-4 w-4" /> Payment
                      </Button>
                    )}
                    <Link href={`/bookings/${b.id}`}>
                      <Button size="sm" variant="ghost">
                        Open
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {actions.dialogs}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BookingsList />
    </Suspense>
  );
}
