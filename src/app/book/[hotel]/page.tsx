"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BedDouble, CalendarDays, Check, Clock, MapPin, MessageCircle, Phone, Users } from "lucide-react";
import { Button, Card, CardContent, Field, Input, Loading, Textarea, Tip } from "@/components/ui";
import { addDays, diffDays } from "@/lib/dates";
import { cn, formatCurrency, formatDate, label } from "@/lib/utils";
import { whatsappLink } from "@/lib/client";

interface Hotel {
  hotelName: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  bookingTerms: string | null;
  websiteAbout: string | null;
  websiteEnabled: boolean;
  today: string;
  roomTypes: Array<{ type: string; fromPrice: number; capacity: number; amenities: string[]; description: string | null; rooms: number }>;
}

interface Option {
  type: string;
  available: number;
  capacity: number;
  description: string | null;
  amenities: string[];
  nights: number;
  roomTotal: number;
  tax: number;
  total: number;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export default function PublicBookingPage() {
  const router = useRouter();
  const { hotel: slug } = useParams<{ hotel: string }>();
  const hotelParam = `hotel=${encodeURIComponent(slug)}`;
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [error, setError] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Option | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "", website: "" });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getJson<Hotel>(`/api/public/hotel?${hotelParam}`)
      .then((h) => {
        setHotel(h);
        setCheckIn(h.today);
        setCheckOut(addDays(h.today, 1));
      })
      .catch((e) => setError(e.message));
  }, [hotelParam]);

  const nights = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;
  const fmt = (n: number) => formatCurrency(n, hotel?.currency);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setChosen(null);
    setSearching(true);
    try {
      const r = await getJson<{ options: Option[] }>(`/api/public/availability?${hotelParam}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${adults + children}`);
      setOptions(r.options);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError((err as Error).message);
      setOptions(null);
    } finally {
      setSearching(false);
    }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await getJson<{ token: string }>(`/api/public/bookings?${hotelParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, checkIn, checkOut, adults, children, roomType: chosen.type }),
      });
      router.push(`/book/confirmation/${r.token}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  if (!hotel) return error ? <div className="p-6"><Tip tone="danger">{error}</Tip></div> : <Loading />;

  const contact = (
    <div className="flex flex-wrap gap-2">
      {hotel.phone && (
        <a href={`tel:${hotel.phone}`}>
          <Button variant="outline" size="sm">
            <Phone className="h-4 w-4" /> Call {hotel.phone}
          </Button>
        </a>
      )}
      {hotel.phone && (
        <a href={whatsappLink(hotel.phone, `Hello ${hotel.hotelName}, I would like to book a room.`)} target="_blank" rel="noopener noreferrer">
          <Button variant="success" size="sm">
            <MessageCircle className="h-4 w-4" /> WhatsApp us
          </Button>
        </a>
      )}
    </div>
  );

  return (
    <div>
      <header className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-100">Book direct · Best price</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{hotel.hotelName}</h1>
          {hotel.tagline && <p className="mt-2 text-lg text-primary-100">{hotel.tagline}</p>}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-primary-100">
            {(hotel.address || hotel.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {[hotel.address, hotel.city].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Check-in {hotel.checkInTime} · Check-out {hotel.checkOutTime}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-16 max-w-5xl space-y-8 px-4 pb-16 sm:px-6">
        {!hotel.websiteEnabled ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-lg font-semibold">Online booking is closed right now.</p>
              <p className="text-slate-600">Please contact us directly to book.</p>
              <div className="flex justify-center">{contact}</div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl">
            <CardContent className="py-5">
              <form onSubmit={search} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                <Field label="Arrival">
                  <Input
                    type="date"
                    value={checkIn}
                    min={hotel.today}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1));
                      setOptions(null);
                    }}
                    required
                  />
                </Field>
                <Field label="Departure">
                  <Input
                    type="date"
                    value={checkOut}
                    min={checkIn ? addDays(checkIn, 1) : undefined}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      setOptions(null);
                    }}
                    required
                  />
                </Field>
                <Field label="Adults">
                  <Input type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
                </Field>
                <Field label="Children">
                  <Input type="number" min={0} max={20} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
                <Button type="submit" size="lg" loading={searching} disabled={nights < 1}>
                  <CalendarDays className="h-5 w-5" /> Check prices
                </Button>
              </form>
              {nights >= 1 && (
                <p className="mt-3 text-sm text-slate-500">
                  {nights} night{nights > 1 ? "s" : ""} · {formatDate(checkIn)} → {formatDate(checkOut)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {error && <Tip tone="danger">{error}</Tip>}

        {options && !chosen && (
          <section id="results" className="space-y-4">
            <h2 className="text-2xl font-bold">Available rooms</h2>
            {options.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 py-8 text-center">
                  <p className="text-lg font-semibold">Sorry, we are full for these dates.</p>
                  <p className="text-slate-600">Try other dates, or contact us — we may be able to help.</p>
                  <div className="flex justify-center">{contact}</div>
                </CardContent>
              </Card>
            ) : (
              options.map((o) => (
                <Card key={o.type}>
                  <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-4">
                      <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 sm:flex">
                        <BedDouble className="h-9 w-9" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{label(o.type)} room</h3>
                        {o.description && <p className="text-slate-600">{o.description}</p>}
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                          <Users className="h-4 w-4" /> Up to {o.capacity} guests
                          {o.available <= 2 && <span className="ml-2 font-semibold text-red-600">Only {o.available} left!</span>}
                        </p>
                        {o.amenities.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                            {o.amenities.map((a) => (
                              <span key={a} className="flex items-center gap-1">
                                <Check className="h-3.5 w-3.5 text-emerald-600" /> {a}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-2xl font-bold">{fmt(o.total)}</p>
                      <p className="text-xs text-slate-500">
                        {o.nights} night{o.nights > 1 ? "s" : ""}, incl. {fmt(o.tax)} tax
                      </p>
                      <Button className="mt-2 w-full sm:w-auto" onClick={() => setChosen(o)}>
                        Book this room
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        )}

        {chosen && (
          <section className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardContent className="py-5">
                <button onClick={() => setChosen(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
                  <ArrowLeft className="h-4 w-4" /> Choose a different room
                </button>
                <h2 className="mb-4 text-2xl font-bold">Your details</h2>
                <form onSubmit={book} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name">
                      <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required autoComplete="given-name" />
                    </Field>
                    <Field label="Last name" optional>
                      <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
                    </Field>
                    <Field label="Mobile number" hint="We will confirm your booking on this number.">
                      <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required autoComplete="tel" />
                    </Field>
                    <Field label="Email" optional>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
                    </Field>
                  </div>
                  <Field label="Special requests" optional hint="Arrival time, extra bed, etc.">
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={500} />
                  </Field>
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="hidden"
                    aria-hidden="true"
                  />
                  {hotel.bookingTerms && (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="mb-1 text-sm font-semibold">Hotel policy</p>
                      <p className="whitespace-pre-line text-sm text-slate-600">{hotel.bookingTerms}</p>
                    </div>
                  )}
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary-600" required />
                    I agree to the hotel policy. I will pay at the hotel.
                  </label>
                  <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!agree}>
                    Confirm booking — pay at hotel
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="h-fit lg:col-span-2">
              <CardContent className="space-y-2 py-5 text-[15px]">
                <p className="text-lg font-bold">{label(chosen.type)} room</p>
                <p className="text-slate-600">
                  {formatDate(checkIn)} → {formatDate(checkOut)}
                </p>
                <p className="text-slate-600">
                  {nights} night{nights > 1 ? "s" : ""} · {adults} adult{adults > 1 ? "s" : ""}
                  {children > 0 && `, ${children} child${children > 1 ? "ren" : ""}`}
                </p>
                <div className="border-t border-slate-100 pt-2">
                  <div className="flex justify-between">
                    <span>Room</span>
                    <span>{fmt(chosen.roomTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes</span>
                    <span>{fmt(chosen.tax)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{fmt(chosen.total)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">No payment needed now. Pay at the hotel on arrival.</p>
              </CardContent>
            </Card>
          </section>
        )}

        {!options && hotel.roomTypes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Our rooms</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hotel.roomTypes.map((t) => (
                <Card key={t.type}>
                  <CardContent className="py-5">
                    <p className="text-lg font-bold">{label(t.type)} room</p>
                    {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
                    <p className="mt-2 text-sm text-slate-500">Up to {t.capacity} guests</p>
                    <p className="mt-3 text-sm text-slate-500">
                      From <span className="text-xl font-bold text-slate-900">{fmt(t.fromPrice)}</span> / night
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {hotel.websiteAbout && (
          <section>
            <h2 className="mb-2 text-2xl font-bold">About us</h2>
            <p className="max-w-3xl text-[15px] leading-relaxed text-slate-700">{hotel.websiteAbout}</p>
          </section>
        )}

        <footer className={cn("flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between")}>
          <div className="text-sm text-slate-500">
            <p className="font-semibold text-slate-700">{hotel.hotelName}</p>
            <p>{[hotel.address, hotel.city].filter(Boolean).join(", ")}</p>
            {hotel.email && <p>{hotel.email}</p>}
          </div>
          {contact}
        </footer>
      </main>
    </div>
  );
}
