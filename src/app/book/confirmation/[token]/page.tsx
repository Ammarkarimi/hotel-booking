"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Phone, Printer } from "lucide-react";
import { Button, Card, CardContent, Loading, Tip } from "@/components/ui";
import { formatCurrency, formatDate, label } from "@/lib/utils";
import { whatsappLink } from "@/lib/client";

interface Confirmation {
  number: number;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType: string;
  adults: number;
  children: number;
  guestName: string;
  total: number;
  paid: number;
  balance: number;
  hotel: { slug: string; hotelName: string; phone: string | null; address: string | null; city: string | null; checkInTime: string; checkOutTime: string; bookingTerms: string | null; currency: string };
}

export default function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const [c, setC] = useState<Confirmation | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/bookings/${token}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Booking not found");
        setC(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="mx-auto max-w-xl p-6"><Tip tone="danger">{error}</Tip></div>;
  if (!c) return <Loading />;
  const fmt = (n: number) => formatCurrency(n, c.hotel.currency);
  const cancelled = c.status === "cancelled" || c.status === "no_show";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="print-page">
        <CardContent className="space-y-5 py-8">
          <div className="text-center">
            <CheckCircle2 className={cancelled ? "mx-auto h-16 w-16 text-slate-400" : "mx-auto h-16 w-16 text-emerald-500"} />
            <h1 className="mt-3 text-2xl font-bold">{cancelled ? "This booking is cancelled" : "Your booking is confirmed!"}</h1>
            <p className="mt-1 text-slate-600">
              {c.hotel.hotelName} · Booking number <b className="text-slate-900">#{c.number}</b>
            </p>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-[15px]">
            <div className="flex justify-between"><span className="text-slate-500">Name</span><b>{c.guestName}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Room</span><b>{label(c.roomType)} room</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Arrival</span><b>{formatDate(c.checkIn)}, from {c.hotel.checkInTime}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Departure</span><b>{formatDate(c.checkOut)}, by {c.hotel.checkOutTime}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Guests</span><b>{c.adults} adult(s){c.children ? `, ${c.children} child(ren)` : ""}</b></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg"><span>Total</span><b>{fmt(c.total)}</b></div>
            {c.paid > 0 && <div className="flex justify-between"><span className="text-slate-500">Paid</span><b>{fmt(c.paid)}</b></div>}
            <div className="flex justify-between"><span className="text-slate-500">Pay at hotel</span><b>{fmt(Math.max(0, c.balance))}</b></div>
          </div>
          <Tip>Please save this page or take a screenshot. Bring a photo ID for every adult guest.</Tip>
          {c.hotel.bookingTerms && <p className="whitespace-pre-line text-sm text-slate-600">{c.hotel.bookingTerms}</p>}
          <div className="no-print grid gap-2 sm:grid-cols-2">
            {c.hotel.phone && (
              <a href={whatsappLink(c.hotel.phone, `Hello, my booking number is #${c.number} (${c.guestName}).`)} target="_blank" rel="noopener noreferrer">
                <Button variant="success" className="w-full"><MessageCircle className="h-5 w-5" /> Message the hotel</Button>
              </a>
            )}
            {c.hotel.phone && (
              <a href={`tel:${c.hotel.phone}`}>
                <Button variant="outline" className="w-full"><Phone className="h-5 w-5" /> Call {c.hotel.phone}</Button>
              </a>
            )}
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-5 w-5" /> Print / save</Button>
            <Link href={`/book/${c.hotel.slug}`}><Button variant="ghost" className="w-full">Back to hotel page</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
