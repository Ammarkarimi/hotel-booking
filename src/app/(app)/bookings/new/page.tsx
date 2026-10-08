"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BedDouble, Check, CheckCircle2, MessageCircle, Printer, Search, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, Field, Input, Loading, PageHeader, Row, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { MethodPicker } from "@/components/booking-actions";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays, diffDays } from "@/lib/dates";
import { computeFolio, priceNights } from "@/lib/pricing";
import { BOOKING_SOURCES, cn, formatCurrency, formatDate, label } from "@/lib/utils";
import type { BookingDTO, GuestDTO, RoomDTO, SettingsDTO } from "@/lib/types";
import type { Folio } from "@/lib/pricing";

type AvailableRoom = RoomDTO & { quote: Folio };
type GuestResult = GuestDTO & { _count?: { bookings: number } };

const STEPS = ["Dates", "Room", "Guest", "Price & payment"];

function StepBar({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            disabled={i > step}
            onClick={() => onJump(i)}
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
              i === step ? "bg-primary-600 text-white" : i < step ? "bg-primary-50 text-primary-700" : "bg-white text-slate-400 ring-1 ring-slate-200"
            )}
          >
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", i === step ? "bg-white/20" : i < step ? "bg-primary-600 text-white" : "bg-slate-100")}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

function NewBookingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings: shell, toast } = useApp();
  const walkInParam = params.get("walkin") === "1";

  const [step, setStep] = useState(0);
  const [walkIn, setWalkIn] = useState(walkInParam);
  const [checkIn, setCheckIn] = useState(params.get("checkIn") || shell.today);
  const [checkOut, setCheckOut] = useState(params.get("checkOut") || addDays(params.get("checkIn") || shell.today, 1));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [roomId, setRoomId] = useState(params.get("room") || "");
  const [typeFilter, setTypeFilter] = useState("all");

  const [guestQuery, setGuestQuery] = useState("");
  const [guestResults, setGuestResults] = useState<GuestResult[]>([]);
  const [guest, setGuest] = useState<GuestResult | null>(null);
  const [newGuest, setNewGuest] = useState({ firstName: "", lastName: "", phone: "", email: "", nationality: "Indian", idType: "aadhar", idNumber: "", address: "" });

  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [customRate, setCustomRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [source, setSource] = useState(walkInParam ? "walk_in" : "phone");
  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState("upi");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<BookingDTO | null>(null);

  const nights = Math.max(0, diffDays(checkIn, checkOut));

  useEffect(() => {
    api<SettingsDTO>("/api/settings").then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = params.get("guestId");
    if (id) {
      api<GuestResult>(`/api/guests/${id}`)
        .then((g) => {
          setGuest(g);
        })
        .catch(() => undefined);
    }
  }, [params]);

  useEffect(() => {
    if (walkIn) {
      setCheckIn(shell.today);
      if (checkOut <= shell.today) setCheckOut(addDays(shell.today, 1));
      setSource("walk_in");
    }
  }, [walkIn, shell.today, checkOut]);

  // Load free rooms whenever dates change.
  useEffect(() => {
    if (nights < 1) {
      setRooms([]);
      return;
    }
    setRooms(null);
    api<AvailableRoom[]>(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}`)
      .then(setRooms)
      .catch((e) => {
        toast(e.message, "error");
        setRooms([]);
      });
  }, [checkIn, checkOut, nights, toast]);

  useEffect(() => {
    const q = guestQuery.trim();
    if (q.length < 2) {
      setGuestResults([]);
      return;
    }
    const t = setTimeout(() => {
      api<GuestResult[]>(`/api/guests?search=${encodeURIComponent(q)}&limit=6`).then(setGuestResults).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [guestQuery]);

  const selectedRoom = rooms?.find((r) => r.id === roomId) ?? null;
  const roomTypes = useMemo(() => [...new Set((rooms ?? []).map((r) => r.type))], [rooms]);
  const visibleRooms = (rooms ?? []).filter((r) => typeFilter === "all" || r.type === typeFilter);
  const guestsCount = adults + children;

  const folio = useMemo(() => {
    if (!selectedRoom || !settings || nights < 1) return null;
    const rate = customRate !== "" ? Number(customRate) : selectedRoom.pricePerNight;
    const fixed = customRate !== "" && Number(customRate) !== selectedRoom.pricePerNight;
    const n = priceNights({
      baseRate: rate,
      checkIn,
      checkOut,
      roomType: selectedRoom.type,
      fixedRate: fixed,
      rules: { weekendSurcharge: settings.weekendSurcharge, seasonalRates: settings.seasonalRates ?? [] },
    });
    return computeFolio({
      nights: n,
      discount: Number(discount) || 0,
      charges: [],
      payments: Number(advance) > 0 ? [{ amount: Number(advance), type: "advance" }] : [],
      tax: { taxMode: settings.taxMode, taxRate: settings.taxRate, gstSlabs: settings.gstSlabs, extrasTaxRate: settings.extrasTaxRate },
    });
  }, [selectedRoom, settings, customRate, discount, advance, checkIn, checkOut, nights]);

  function setNights(n: number) {
    setCheckOut(addDays(checkIn, n));
  }

  const guestReady = !!guest || (newGuest.firstName.trim() && newGuest.phone.trim().length >= 5);
  const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : `${newGuest.firstName} ${newGuest.lastName}`.trim();

  async function submit() {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const booking = await api<BookingDTO>("/api/bookings", {
        body: {
          roomId: selectedRoom.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults,
          children,
          source,
          discount: Number(discount) || 0,
          ...(customRate !== "" && { ratePerNight: Number(customRate) }),
          notes,
          checkInNow: walkIn,
          ...(guest ? { guestId: guest.id } : { guest: { ...newGuest, idNumber: newGuest.idNumber || undefined } }),
          ...(Number(advance) > 0 && { advance: { amount: Number(advance), method } }),
        },
      });
      setCreated(booking);
      toast(walkIn ? `${booking.guestName} checked in to Room ${booking.room.roomNumber}` : `Booking #${booking.number} confirmed`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    const msg = [
      `Dear ${created.guestName},`,
      `Your booking at ${shell.hotelName} is confirmed.`,
      `Booking no: #${created.number}`,
      `Room: ${label(created.room.type)} (Room ${created.room.roomNumber})`,
      `Arrival: ${formatDate(created.checkInDate)}${settings ? ` from ${settings.checkInTime}` : ""}`,
      `Departure: ${formatDate(created.checkOutDate)}${settings ? ` by ${settings.checkOutTime}` : ""}`,
      `Total: ${formatCurrency(created.folio.grandTotal)}${created.folio.netPaid > 0 ? `, paid ${formatCurrency(created.folio.netPaid)}` : ""}`,
      settings?.phone ? `Questions? Call us on ${settings.phone}` : "",
      "Thank you!",
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <div className="mx-auto max-w-xl py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-bold">{walkIn ? "Guest checked in!" : "Booking confirmed!"}</h1>
            <p className="mt-1 text-lg text-slate-600">
              Booking <b>#{created.number}</b> · {created.guestName} · Room {created.room.roomNumber}
            </p>
            <p className="text-slate-500">
              {formatDate(created.checkInDate)} → {formatDate(created.checkOutDate)} · Total {formatCurrency(created.folio.grandTotal)}
            </p>
            {created.folio.balance > 0.5 && <p className="mt-1 font-semibold text-red-600">Still to pay: {formatCurrency(created.folio.balance)}</p>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <a href={whatsappLink(created.guest.phone, msg)} target="_blank" rel="noopener noreferrer">
                <Button variant="success" className="w-full">
                  <MessageCircle className="h-5 w-5" /> Send on WhatsApp
                </Button>
              </a>
              <a href={`/print/confirmation/${created.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  <Printer className="h-5 w-5" /> Print confirmation
                </Button>
              </a>
              <Button onClick={() => router.push(`/bookings/${created.id}`)}>Open booking</Button>
              <Button variant="outline" onClick={() => window.location.assign("/bookings/new")}>
                Make another booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={walkIn ? "Walk-in guest" : "New booking"}
        description={walkIn ? "The guest is at the desk now. They will be checked in straight away." : "Follow the 4 steps. You can go back at any time."}
        back={
          <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to Today
          </Link>
        }
      />
      <StepBar step={step} onJump={setStep} />

      {step === 0 && (
        <Card>
          <CardContent className="space-y-5 py-5">
            <Toggle checked={walkIn} onChange={setWalkIn} label="The guest is here now (walk-in)" description="Turn on to check the guest in immediately after booking." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Arrival date">
                <Input
                  type="date"
                  value={checkIn}
                  min={shell.today}
                  disabled={walkIn}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCheckIn(v);
                    if (checkOut <= v) setCheckOut(addDays(v, Math.max(1, nights)));
                  }}
                />
              </Field>
              <Field label="Leaving date">
                <Input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Or choose number of nights</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 7, 10, 14].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNights(n)}
                    className={cn(
                      "min-w-14 rounded-xl border px-3 py-2 text-sm font-semibold",
                      nights === n ? "border-primary-500 bg-primary-50 text-primary-700" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    {n} night{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
              <Field label="Adults">
                <Input type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Field label="Children">
                <Input type="number" min={0} max={20} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            </div>
            {nights >= 1 ? (
              <Tip>
                <b>{nights} night{nights > 1 ? "s" : ""}</b>: arriving {formatDate(checkIn)}, leaving {formatDate(checkOut)}.
              </Tip>
            ) : (
              <Tip tone="danger">The leaving date must be after the arrival date.</Tip>
            )}
            <div className="flex justify-end">
              <Button size="lg" disabled={nights < 1} onClick={() => setStep(1)}>
                Next: choose a room <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-slate-600">
              Free rooms for <b>{formatDate(checkIn)} → {formatDate(checkOut)}</b> ({nights} night{nights > 1 ? "s" : ""})
            </p>
            {roomTypes.length > 1 && (
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-56">
                <option value="all">All room types</option>
                {roomTypes.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {rooms === null ? (
            <Loading text="Finding free rooms..." />
          ) : visibleRooms.length === 0 ? (
            <EmptyState
              icon={<BedDouble className="h-6 w-6" />}
              title="No rooms are free for these dates"
              description="Try different dates, or check the room calendar to see when rooms become free."
              action={<Button onClick={() => setStep(0)}>Change dates</Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRooms.map((r) => {
                const tooSmall = r.capacity < guestsCount;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoomId(r.id)}
                    className={cn(
                      "rounded-2xl border-2 bg-white p-4 text-left transition",
                      roomId === r.id ? "border-primary-500 ring-4 ring-primary-100" : "border-slate-200 hover:border-primary-300"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xl font-bold">Room {r.roomNumber}</p>
                        <p className="text-sm text-slate-500">
                          {label(r.type)} {r.floor && `· ${r.floor} floor`}
                        </p>
                      </div>
                      {roomId === r.id ? <CheckCircle2 className="h-6 w-6 text-primary-600" /> : r.housekeeping !== "clean" && <Badge variant={r.housekeeping}>{label(r.housekeeping)}</Badge>}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                      <Users className="h-4 w-4" /> Up to {r.capacity} guest{r.capacity > 1 ? "s" : ""}
                      {tooSmall && <Badge variant="warning" className="ml-1">Small for {guestsCount}</Badge>}
                    </p>
                    {r.amenities.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{r.amenities.join(" · ")}</p>}
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-lg font-bold text-primary-700">{formatCurrency(r.quote.grandTotal)}</p>
                      <p className="text-xs text-slate-500">
                        total incl. tax · {formatCurrency(r.pricePerNight)} per night
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="outline" size="lg" onClick={() => setStep(0)}>
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <Button size="lg" disabled={!selectedRoom} onClick={() => setStep(2)}>
              Next: guest details <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-5 py-5">
            {guest ? (
              <div className="flex flex-col gap-3 rounded-xl border-2 border-primary-200 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold">
                    {guest.firstName} {guest.lastName} {guest.vip && <Badge variant="purple">VIP</Badge>}
                  </p>
                  <p className="text-sm text-slate-600">
                    {guest.phone}
                    {guest._count?.bookings ? ` · ${guest._count.bookings} previous booking(s)` : ""}
                  </p>
                  {guest.blacklisted && <p className="mt-1 text-sm font-semibold text-red-600">⚠ This guest is marked as “Do not allow”. {guest.notes}</p>}
                </div>
                <Button variant="outline" onClick={() => setGuest(null)}>
                  Choose a different guest
                </Button>
              </div>
            ) : (
              <>
                <Field label="Has this guest stayed before?" hint="Type their name or phone number to find them.">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-10" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} placeholder="Name or phone number" />
                  </div>
                </Field>
                {guestResults.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {guestResults.map((g) => (
                      <button key={g.id} type="button" onClick={() => setGuest(g)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                        <span>
                          <span className="block font-semibold">
                            {g.firstName} {g.lastName} {g.blacklisted && <Badge variant="danger">Do not allow</Badge>}
                          </span>
                          <span className="block text-sm text-slate-500">{g.phone}</span>
                        </span>
                        <span className="text-sm font-semibold text-primary-600">Choose</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                    <UserPlus className="h-5 w-5 text-primary-600" /> New guest
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name">
                      <Input value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} autoFocus={!guestQuery} />
                    </Field>
                    <Field label="Last name" optional>
                      <Input value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} />
                    </Field>
                    <Field label="Mobile number" hint="Used to send the booking on WhatsApp.">
                      <Input type="tel" inputMode="tel" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="98765 43210" />
                    </Field>
                    <Field label="Email" optional>
                      <Input type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
                    </Field>
                    <Field label="Nationality">
                      <Input value={newGuest.nationality} onChange={(e) => setNewGuest({ ...newGuest, nationality: e.target.value, idType: e.target.value.toLowerCase() === "indian" ? newGuest.idType : "passport" })} />
                    </Field>
                    <Field label="ID proof" optional hint="You can also upload a photo of the ID later.">
                      <div className="flex gap-2">
                        <Select value={newGuest.idType} onChange={(e) => setNewGuest({ ...newGuest, idType: e.target.value })} className="w-40">
                          {["aadhar", "passport", "driving_licence", "voter_id", "pan", "other"].map((t) => (
                            <option key={t} value={t}>
                              {label(t)}
                            </option>
                          ))}
                        </Select>
                        <Input value={newGuest.idNumber} onChange={(e) => setNewGuest({ ...newGuest, idNumber: e.target.value })} placeholder="ID number" />
                      </div>
                    </Field>
                    <Field label="Address" optional className="sm:col-span-2">
                      <Input value={newGuest.address} onChange={(e) => setNewGuest({ ...newGuest, address: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button
                size="lg"
                disabled={!guestReady}
                onClick={() => setStep(3)}
              >
                Next: price & payment <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && selectedRoom && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="space-y-4 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price per night" hint={`Normal price: ${formatCurrency(selectedRoom.pricePerNight)}. Change only for a special deal.`}>
                  <Input type="number" min={0} inputMode="decimal" placeholder={String(selectedRoom.pricePerNight)} value={customRate} onChange={(e) => setCustomRate(e.target.value)} />
                </Field>
                <Field label="Discount (amount)" optional>
                  <Input type="number" min={0} inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </Field>
              </div>
              <Field label="How did this booking come?">
                <Select value={source} onChange={(e) => setSource(e.target.value)}>
                  {BOOKING_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Advance payment received now" optional hint="Leave empty if the guest will pay later.">
                <Input type="number" min={0} inputMode="decimal" placeholder="0" value={advance} onChange={(e) => setAdvance(e.target.value)} className="text-lg font-semibold" />
              </Field>
              {Number(advance) > 0 && (
                <Field label="Paid by">
                  <MethodPicker value={method} onChange={setMethod} />
                </Field>
              )}
              <Field label="Notes" optional hint="Special requests, arrival time, etc.">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </Field>
            </CardContent>
          </Card>

          <Card className="h-fit lg:col-span-2">
            <CardContent className="py-5">
              <p className="mb-3 text-lg font-bold">Summary</p>
              <div className="space-y-1 text-[15px]">
                <p>
                  <b>{guestName}</b>
                </p>
                <p className="text-slate-600">
                  Room {selectedRoom.roomNumber} ({label(selectedRoom.type)}) · {adults} adult{adults > 1 ? "s" : ""}
                  {children > 0 && `, ${children} child${children > 1 ? "ren" : ""}`}
                </p>
                <p className="text-slate-600">
                  {formatDate(checkIn)} → {formatDate(checkOut)} ({nights} night{nights > 1 ? "s" : ""})
                </p>
              </div>
              {folio ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Row label="Room">{formatCurrency(folio.roomTotal)}</Row>
                  {folio.discount > 0 && <Row label="Discount">− {formatCurrency(folio.discount)}</Row>}
                  <Row label={`Tax (${folio.roomTaxRate}%)`}>{formatCurrency(folio.taxTotal)}</Row>
                  <Row label="Total" strong>
                    {formatCurrency(folio.grandTotal)}
                  </Row>
                  {folio.netPaid > 0 && <Row label="Advance">− {formatCurrency(folio.netPaid)}</Row>}
                  <Row label="To pay later" strong>
                    <span className="text-primary-700">{formatCurrency(Math.max(0, folio.balance))}</span>
                  </Row>
                  {folio.nights.some((n) => n.adjustment !== 0) && <p className="mt-2 text-xs text-slate-500">Includes weekend / special-date price changes.</p>}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Calculating price…</p>
              )}
              <Button size="lg" variant={walkIn ? "success" : "primary"} className="mt-5 w-full" loading={saving} onClick={submit}>
                <Check className="h-5 w-5" /> {walkIn ? "Book & check in now" : "Confirm booking"}
              </Button>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewBookingWizard />
    </Suspense>
  );
}
