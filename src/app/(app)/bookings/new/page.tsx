"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BedDouble, Check, CheckCircle2, ClipboardCheck, Lightbulb, MessageCircle, Pencil, Printer, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, CardContent, CountInput, EmptyState, Field, Input, Loading, PageHeader, Row, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { GstPicker, MethodPicker } from "@/components/booking-actions";
import { FormDetails } from "@/components/guest-form-send";
import { EditGuestFormDialog } from "@/components/guest-form-edit";
import { useGuestMessage } from "@/components/guest-message";
import { useApp } from "@/components/app-provider";
import { AddressFields, ID_CHECK_TYPES, IdCheckFields, TravelFields, emptyAddress, emptyTravel, sizeCompanions } from "@/components/pathik-details";
import type { DeskAddress, DeskIdCheck, DeskTravel } from "@/components/pathik-details";
import { deskPathikMissing, isIndian } from "@/lib/guest-form";
import { api, whatsappLink } from "@/lib/client";
import { addDays, diffDays } from "@/lib/dates";
import { isOtaSource } from "@/lib/payouts";
import { computeFolio, priceNights } from "@/lib/pricing";
import { BOOKING_SOURCES, cn, formatCurrency, formatDate, label } from "@/lib/utils";
import type { BookingDTO, GuestDTO, GuestFormDTO, RateTip, RateTipsDTO, RoomDTO, SettingsDTO } from "@/lib/types";
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
  const guestMessage = useGuestMessage();
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
  const [newGuest, setNewGuest] = useState({ firstName: "", lastName: "", phone: "", email: "", nationality: "Indian", address: "" });

  // For the police register (Pathik): the guest's full address, the journey and the other adults.
  const [address, setAddress] = useState<DeskAddress>(emptyAddress);
  const [travel, setTravel] = useState<DeskTravel>(emptyTravel);
  // A returning guest whose profile has no surname or email yet.
  const [profileFix, setProfileFix] = useState({ lastName: "", email: "" });
  // The ID of every adult, ticked once staff have seen the original (index 0 = the guest).
  const [idChecks, setIdChecks] = useState<DeskIdCheck[]>([]);

  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [customRate, setCustomRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [gstRate, setGstRate] = useState<number | null>(null); // null = the default from Settings
  const [source, setSource] = useState(walkInParam ? "walk_in" : "phone");
  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState("upi");
  const [notes, setNotes] = useState("");
  const [otaReference, setOtaReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<BookingDTO | null>(null);

  // Booking from a guest form sent on WhatsApp: the guest's details come from the form.
  const [guestForm, setGuestForm] = useState<GuestFormDTO | null>(null);
  const [sameNumber, setSameNumber] = useState<GuestResult[]>([]);
  const [linkGuestId, setLinkGuestId] = useState(""); // "" = a new guest profile

  const [editForm, setEditForm] = useState(false);
  // Tonight's rate tips by room type (Rate tips), shown next to the price for a stay starting today.
  const [tips, setTips] = useState<Record<string, RateTip>>({});

  const nights = Math.max(0, diffDays(checkIn, checkOut));

  useEffect(() => setTravel((t) => ({ ...t, companions: sizeCompanions(t.companions, adults) })), [adults]);

  // A returning guest: what their profile already has.
  const guestKey = guest?.id;
  useEffect(() => {
    setProfileFix({ lastName: guest?.lastName ?? "", email: guest?.email ?? "" });
    if (!guest) return setAddress(emptyAddress);
    setAddress({
      address: guest.address ?? "",
      dateOfBirth: guest.dateOfBirth?.slice(0, 10) ?? "",
      locality: guest.locality ?? "",
      city: guest.city ?? "",
      district: guest.district ?? "",
      state: guest.state ?? "",
      pinCode: guest.pinCode ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestKey]);

  /** The stay as the guest (or the desk, after a change) filled it in. */
  const applyForm = useCallback(
    (f: GuestFormDTO) => {
      const d = f.details!;
      setGuestForm(f);
      setCheckIn(d.checkIn < shell.today ? shell.today : d.checkIn);
      setCheckOut(d.checkOut > shell.today ? d.checkOut : addDays(shell.today, 1));
      setAdults(d.adults);
      setChildren(d.children);
      if (d.requests) setNotes(d.requests);
    },
    [shell.today]
  );

  useEffect(() => {
    const id = params.get("form");
    if (!id) return;
    api<GuestFormDTO>(`/api/guest-forms/${id}`)
      .then((f) => {
        if (f.status !== "submitted" || !f.details) {
          toast(f.status === "booked" ? "A booking has already been made from this form." : "This form has not been filled in yet.", "error");
          return;
        }
        const d = f.details;
        applyForm(f);
        api<GuestResult[]>(`/api/guests?search=${encodeURIComponent(d.phone)}&limit=5`)
          .then((list) => {
            setSameNumber(list);
            // The same person stayed before: keep one profile for them.
            const same = list.find((g) => g.firstName.trim().toLowerCase() === d.firstName.trim().toLowerCase());
            if (same) setLinkGuestId(same.id);
          })
          .catch(() => undefined);
      })
      .catch((e) => toast(e.message, "error"));
  }, [params, shell.today, toast, applyForm]);

  useEffect(() => {
    api<SettingsDTO>("/api/settings").then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    setTips({});
    // Tips are for tonight only. A request still running when the date changes is ignored.
    if (checkIn !== shell.today || !shell.modules.includes("rate_tips")) return;
    let current = true;
    api<RateTipsDTO>("/api/rate-tips")
      .then((d) => current && d.date === checkIn && setTips(Object.fromEntries(d.types.flatMap((t) => (t.tip ? [[t.type, t.tip]] : [])))))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [checkIn, shell.today, shell.modules]);

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

  // A walk-in needs the room now, so a room whose guest is leaving today but has not checked out yet cannot be used.
  const stillInside = (r: AvailableRoom) => walkIn && r.status === "occupied";
  const selectedRoom = rooms?.find((r) => r.id === roomId && !stillInside(r)) ?? null;
  const roomTypes = useMemo(() => [...new Set((rooms ?? []).map((r) => r.type))], [rooms]);
  const visibleRooms = (rooms ?? [])
    .filter((r) => typeFilter === "all" || r.type === typeFilter)
    .sort((a, b) => Number(stillInside(a)) - Number(stillInside(b)));
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
      gstRate,
    });
  }, [selectedRoom, settings, customRate, discount, advance, checkIn, checkOut, nights, gstRate]);

  function setNights(n: number) {
    setCheckOut(addDays(checkIn, n));
  }

  // With Pathik switched on, everything Pathik's form asks for is needed before going on.
  const pathikMissing =
    !shell.pathik || guestForm || (!guest && !newGuest.firstName.trim())
      ? []
      : deskPathikMissing({
          ...address,
          ...(guest
            ? { lastName: guest.lastName || profileFix.lastName, email: guest.email || profileFix.email, phone: guest.phone, nationality: guest.nationality }
            : { lastName: newGuest.lastName, email: newGuest.email, phone: newGuest.phone, nationality: newGuest.nationality }),
          ...travel,
          adults,
        });
  const guestName = guestForm?.details
    ? `${guestForm.details.firstName} ${guestForm.details.lastName}`.trim()
    : guest
      ? `${guest.firstName} ${guest.lastName}`.trim()
      : `${newGuest.firstName} ${newGuest.lastName}`.trim();
  // Everyone in the room, for the ID check: the guest, then the other adults by name.
  const formDetails = guestForm?.details;
  const nationality = formDetails?.nationality ?? guest?.nationality ?? newGuest.nationality;
  const firstId = isIndian(nationality) ? "aadhar" : "passport";
  const idPeople = formDetails
    ? [
        { name: guestName || "Guest", defaultType: formDetails.aadhaarAtDesk ? "aadhar" : firstId },
        ...formDetails.companions.map((c) => ({ name: c.name, defaultType: c.aadhaarAtDesk ? "aadhar" : firstId })),
      ]
    : [
        { name: guestName || "Guest", defaultType: guest?.idType && ID_CHECK_TYPES.includes(guest.idType as never) ? guest.idType : firstId },
        ...travel.companions.map((c, i) => ({ name: c.name.trim() || `Adult ${i + 2}`, defaultType: "aadhar" })),
      ];
  const idRows = idPeople.map((p, i) => idChecks[i] ?? { idType: p.defaultType, seen: false });
  const idsDone = idRows.every((r) => r.seen);
  /** The ticked IDs as the server keeps them: null = the guest, otherwise the adult's name. */
  const idCheckBody = idRows
    .map((r, i) => ({ ...r, person: i === 0 ? null : formDetails ? formDetails.companions[i - 1].name : travel.companions[i - 1].name.trim() || `Adult ${i + 1}` }))
    .filter((r) => r.seen)
    .map(({ person, idType }) => ({ person, idType }));
  const guestReady = (!!guestForm || !!guest || (newGuest.firstName.trim() && newGuest.phone.trim().length >= 5)) && pathikMissing.length === 0 && (!walkIn || idsDone);
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
          ...(gstRate !== null && { gstRate }),
          ...(customRate !== "" && { ratePerNight: Number(customRate) }),
          notes,
          ...(isOtaSource(source) && otaReference.trim() && { otaReference: otaReference.trim() }),
          checkInNow: walkIn,
          idChecks: idCheckBody,
          ...(guestForm
            ? { guestFormId: guestForm.id, ...(linkGuestId && { guestId: linkGuestId }) }
            : {
                ...(guest
                  ? { guestId: guest.id, guestDetails: { ...address, ...(!guest.lastName && { lastName: profileFix.lastName.trim() }), ...(!guest.email && { email: profileFix.email.trim() }) } }
                  : { guest: { ...newGuest, ...address, idType: idRows[0]?.seen ? idRows[0].idType : undefined } }),
                comingFrom: travel.comingFrom,
                goingTo: travel.goingTo,
                vehicleType: travel.vehicleType,
                vehicleNumber: travel.vehicleNumber,
                companions: travel.companions.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })),
              }),
          ...(Number(advance) > 0 && { advance: { amount: Number(advance), method } }),
        },
      });
      setCreated(booking);
      if (guestForm) window.dispatchEvent(new Event("guest-forms-changed"));
      toast(walkIn ? `${booking.guestName} checked in to Room ${booking.room.roomNumber}` : `Booking #${booking.number} confirmed`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    // A walk-in is already checked in, so they get the welcome message; others the booking confirmation.
    const msg = guestMessage(created.status === "checked_in" ? "checkIn" : "booking", created);
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
                <CountInput min={1} max={20} value={adults} onChange={setAdults} aria-label="adults" />
              </Field>
              <Field label="Children">
                <CountInput min={0} max={20} value={children} onChange={setChildren} aria-label="children" />
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
                const occupied = stillInside(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={occupied}
                    onClick={() => setRoomId(r.id)}
                    className={cn(
                      "rounded-2xl border-2 bg-white p-4 text-left transition",
                      occupied
                        ? "cursor-not-allowed border-slate-200 opacity-60"
                        : roomId === r.id
                          ? "border-primary-500 ring-4 ring-primary-100"
                          : "border-slate-200 hover:border-primary-300"
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
                    {occupied && <p className="mt-1 text-sm font-semibold text-amber-700">Today&apos;s guest has not checked out yet</p>}
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
            {guestForm ? (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-primary-200 bg-primary-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-lg font-bold">
                      <ClipboardCheck className="h-5 w-5 text-primary-600" /> {guestName}: from the guest form
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setEditForm(true)}>
                      <Pencil className="h-4 w-4" /> Edit details
                    </Button>
                  </div>
                  <FormDetails form={guestForm} />
                </div>
                <EditGuestFormDialog
                  form={guestForm}
                  open={editForm}
                  onClose={() => setEditForm(false)}
                  onSaved={(f) => {
                    const d = guestForm.details!;
                    const n = f.details!;
                    const stayChanged = n.checkIn !== d.checkIn || n.checkOut !== d.checkOut || n.adults !== d.adults || n.children !== d.children;
                    if (n.requests !== d.requests) setNotes(n.requests);
                    applyForm(f);
                    if (stayChanged) toast("The dates and people on this booking now match the changed details. Please check the room.");
                  }}
                />
                {sameNumber.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-2 font-semibold">This mobile number is already saved. Whose profile is this?</p>
                    <div className="space-y-2">
                      {sameNumber.map((g) => (
                        <label key={g.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input type="radio" name="link" className="mt-1 h-4 w-4 accent-primary-600" checked={linkGuestId === g.id} onChange={() => setLinkGuestId(g.id)} />
                          <span>
                            <span className="font-semibold">
                              {g.firstName} {g.lastName}
                            </span>{" "}
                            {g.blacklisted && <Badge variant="danger">Do not allow</Badge>}
                            <span className="block text-sm text-slate-500">Same person: their profile is updated from the form</span>
                          </span>
                        </label>
                      ))}
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <input type="radio" name="link" className="mt-1 h-4 w-4 accent-primary-600" checked={linkGuestId === ""} onChange={() => setLinkGuestId("")} />
                        <span>
                          <span className="font-semibold">Someone else</span>
                          <span className="block text-sm text-slate-500">Add {guestName} as a new guest</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : guest ? (
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
            ) : null}
            {!guestForm && guest && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-1 font-semibold text-slate-800">Address and date of birth</p>
                <p className="mb-3 text-sm text-slate-500">From their profile. Fill in what is empty: it is saved to the profile{shell.pathik ? " and goes to Pathik" : ""}.</p>
                {(!guest.lastName || !guest.email) && (
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    {!guest.lastName && (
                      <Field label="Last name" optional={!shell.pathik}>
                        <Input value={profileFix.lastName} onChange={(e) => setProfileFix({ ...profileFix, lastName: e.target.value })} maxLength={80} />
                      </Field>
                    )}
                    {!guest.email && (
                      <Field label="Email" optional={!shell.pathik}>
                        <Input type="email" value={profileFix.email} onChange={(e) => setProfileFix({ ...profileFix, email: e.target.value })} maxLength={120} />
                      </Field>
                    )}
                  </div>
                )}
                <AddressFields value={address} onChange={setAddress} indian={isIndian(guest.nationality)} today={shell.today} required={shell.pathik} />
              </div>
            )}
            {!guestForm && !guest && (
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
                    <Field label="Last name" optional={!shell.pathik}>
                      <Input value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} />
                    </Field>
                    <Field label="Mobile number" hint="Used to send the booking on WhatsApp.">
                      <Input type="tel" inputMode="tel" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="98765 43210" />
                    </Field>
                    <Field label="Email" optional={!shell.pathik}>
                      <Input type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
                    </Field>
                    <Field label="Nationality">
                      <Input value={newGuest.nationality} onChange={(e) => setNewGuest({ ...newGuest, nationality: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <AddressFields value={address} onChange={setAddress} indian={isIndian(newGuest.nationality)} today={shell.today} required={shell.pathik} />
                  </div>
                </div>
              </>
            )}
            {!guestForm && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-1 font-semibold text-slate-800">Journey and other adults</p>
                <p className="mb-3 text-sm text-slate-500">
                  {shell.pathik ? "The police register (Pathik) asks for these." : "Optional. You can also add them later with Change booking."}
                </p>
                <TravelFields
                  value={travel}
                  onChange={setTravel}
                  adults={adults}
                  required={shell.pathik}
                  onAdults={(n, companions, removed) => {
                    setTravel({ ...travel, companions });
                    // The ID tick of the adult taken off goes with them (row 0 is the guest).
                    if (removed !== undefined) setIdChecks(idRows.filter((_, j) => j !== removed + 1));
                    setAdults(Math.max(1, n));
                  }}
                />
                {selectedRoom && adults + children > selectedRoom.capacity && (
                  <div className="mt-3">
                    <Tip tone="warning">
                      Room {selectedRoom.roomNumber} is for up to {selectedRoom.capacity} guest{selectedRoom.capacity > 1 ? "s" : ""}. Go back to choose a bigger room, or add an extra bed later.
                    </Tip>
                  </div>
                )}
              </div>
            )}
            <div className={cn("rounded-xl border-2 p-4", idsDone ? "border-emerald-200" : walkIn ? "border-amber-300" : "border-slate-200")}>
              <p className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                <ShieldCheck className={cn("h-5 w-5", idsDone ? "text-emerald-600" : "text-amber-600")} /> ID check
                {walkIn ? "" : <span className="text-sm font-normal text-slate-500">(optional for a booking in advance)</span>}
              </p>
              <p className="mb-3 text-sm text-slate-500">Choose which ID each adult has and tick it once you have seen the original.</p>
              <IdCheckFields people={idPeople} value={idRows} onChange={setIdChecks} required={walkIn} />
            </div>
            {pathikMissing.length > 0 && (
              <Tip tone="warning">
                <b>Still needed for Pathik:</b> {pathikMissing.join(", ")}.
              </Tip>
            )}
            {walkIn && !idsDone && (
              <Tip tone="warning">
                <b>Verify the ID of every adult</b> to go on to price & payment.
              </Tip>
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
                <Field label="Price per night" htmlFor="price-per-night" hint={`Normal price: ${formatCurrency(selectedRoom.pricePerNight)}. Change only for a special deal.`}>
                  <Input id="price-per-night" type="number" min={0} inputMode="decimal" placeholder={String(selectedRoom.pricePerNight)} value={customRate} onChange={(e) => setCustomRate(e.target.value)} />
                  {tips[selectedRoom.type] && tips[selectedRoom.type].price < selectedRoom.pricePerNight && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Lightbulb className="h-4 w-4" /> Rate tip for tonight: {formatCurrency(tips[selectedRoom.type].price)}
                      </p>
                      <p className="text-xs">
                        {tips[selectedRoom.type].free} {label(selectedRoom.type)} room{tips[selectedRoom.type].free === 1 ? " is" : "s are"} still free.
                        {nights > 1 && " The tip is for tonight; the same price will apply to every night."}
                      </p>
                      {customRate !== String(tips[selectedRoom.type].price) && (
                        <Button size="sm" variant="outline" className="mt-1.5" onClick={() => setCustomRate(String(tips[selectedRoom.type].price))}>
                          Use {formatCurrency(tips[selectedRoom.type].price)}
                        </Button>
                      )}
                    </div>
                  )}
                </Field>
                <Field label="Discount (amount)" optional>
                  <Input type="number" min={0} inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </Field>
              </div>
              {folio && (
                <Field label="GST on the room" hint="The default comes from Settings. Change it only if this booking needs a different rate.">
                  <GstPicker value={gstRate} defaultRate={folio.defaultRoomTaxRate} onChange={setGstRate} />
                </Field>
              )}
              <Field label="How did this booking come?">
                <Select value={source} onChange={(e) => setSource(e.target.value)}>
                  {BOOKING_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              {isOtaSource(source) && (
                <Field label={`${label(source)} booking ID`} optional hint="Their own booking number, to match their payment statement later.">
                  <Input value={otaReference} onChange={(e) => setOtaReference(e.target.value)} maxLength={60} />
                </Field>
              )}
              <Field
                label="Advance payment received now"
                optional
                hint={
                  isOtaSource(source)
                    ? "If the guest already paid on the booking site, enter the full amount and choose “Booking site (prepaid)”."
                    : "Leave empty if the guest will pay later."
                }
              >
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
                  <Row label={`GST (${folio.roomTaxRate}%)`}>{formatCurrency(folio.taxTotal)}</Row>
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
