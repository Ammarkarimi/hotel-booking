import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, serializeBooking, type SerializedBooking } from "@/lib/bookings";
import { amountInWords } from "@/lib/words";
import { todayKey } from "@/lib/dates";
import { formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { HotelSettingsRecord } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print" };

type Params = { params: Promise<{ kind: string; id: string }> };

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function HotelHeader({ s, title, subtitle }: { s: HotelSettingsRecord; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div>
        <h1 className="text-2xl font-bold">{s.hotelName}</h1>
        {s.tagline && <p className="text-sm text-slate-600">{s.tagline}</p>}
        <p className="mt-1 text-sm text-slate-700">{[s.address, s.city].filter(Boolean).join(", ")}</p>
        <p className="text-sm text-slate-700">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>
        {s.gstin && <p className="text-sm font-semibold">GSTIN: {s.gstin}</p>}
      </div>
      <div className="text-right">
        <p className="text-xl font-bold uppercase tracking-wide">{title}</p>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
    </div>
  );
}

function Info({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-32 shrink-0 text-slate-500">{l}</span>
      <span className="font-medium">{children || "—"}</span>
    </div>
  );
}

function Invoice({ b, s }: { b: SerializedBooking; s: HotelSettingsRecord }) {
  const f = b.folio;
  const cur = s.currency;
  const final = !!b.bill;
  const half = (n: number) => Math.round((n / 2) * 100) / 100;
  return (
    <>
      <HotelHeader s={s} title={final ? "Tax Invoice" : "Proforma Bill"} subtitle={final ? `No. ${b.bill!.invoiceNumber}` : "Not a tax invoice — stay in progress"} />
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Billed to</p>
          <p className="font-semibold">{b.guest.company || b.guestName}</p>
          {b.guest.company && <p className="text-sm">Guest: {b.guestName}</p>}
          {b.guest.address && <p className="text-sm">{b.guest.address}</p>}
          <p className="text-sm">{b.guest.phone}</p>
          {b.guest.gstin && <p className="text-sm font-semibold">GSTIN: {b.guest.gstin}</p>}
        </div>
        <div>
          <Info label="Invoice date">{formatDate(todayKey(s.timezone, b.bill ? b.bill.generatedAt : new Date()))}</Info>
          <Info label="Booking no.">#{b.number}</Info>
          <Info label="Room">
            {b.room.roomNumber} ({label(b.room.type)})
          </Info>
          <Info label="Arrival">{formatDate(b.checkInDate)}</Info>
          <Info label="Departure">{formatDate(b.checkOutDate)}</Info>
          <Info label="Guests">
            {b.adults} adult(s){b.children ? `, ${b.children} child(ren)` : ""}
          </Info>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-800 text-left">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2">SAC</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-2 pr-2">Room accommodation — Room {b.room.roomNumber}</td>
            <td className="py-2 pr-2">996311</td>
            <td className="py-2 pr-2 text-right">{f.nightCount} night(s)</td>
            <td className="py-2 pr-2 text-right">{money(f.nightCount ? f.roomTotal / f.nightCount : 0, cur)}</td>
            <td className="py-2 text-right">{money(f.roomTotal, cur)}</td>
          </tr>
          {f.discount > 0 && (
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2">Less: discount</td>
              <td />
              <td />
              <td />
              <td className="py-2 text-right">− {money(f.discount, cur)}</td>
            </tr>
          )}
          {b.charges.map((c) => (
            <tr key={c.id} className="border-b border-slate-200">
              <td className="py-2 pr-2">
                {c.description} <span className="text-xs text-slate-500">({formatDate(c.date)})</span>
              </td>
              <td className="py-2 pr-2">{c.category === "food" || c.category === "minibar" ? "996331" : "9997"}</td>
              <td className="py-2 pr-2 text-right">{c.quantity}</td>
              <td className="py-2 pr-2 text-right">{money(c.unitPrice, cur)}</td>
              <td className="py-2 text-right">{money(c.amount, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-80 text-sm">
          <tbody>
            <tr>
              <td className="py-1">Taxable value</td>
              <td className="py-1 text-right">{money(f.roomAfterDiscount + f.extrasTotal, cur)}</td>
            </tr>
            {f.roomTax > 0 && (
              <>
                <tr>
                  <td className="py-1">CGST on room @ {f.roomTaxRate / 2}%</td>
                  <td className="py-1 text-right">{money(half(f.roomTax), cur)}</td>
                </tr>
                <tr>
                  <td className="py-1">SGST on room @ {f.roomTaxRate / 2}%</td>
                  <td className="py-1 text-right">{money(f.roomTax - half(f.roomTax), cur)}</td>
                </tr>
              </>
            )}
            {f.extrasTax > 0 && (
              <>
                <tr>
                  <td className="py-1">CGST on extras @ {f.extrasTaxRate / 2}%</td>
                  <td className="py-1 text-right">{money(half(f.extrasTax), cur)}</td>
                </tr>
                <tr>
                  <td className="py-1">SGST on extras @ {f.extrasTaxRate / 2}%</td>
                  <td className="py-1 text-right">{money(f.extrasTax - half(f.extrasTax), cur)}</td>
                </tr>
              </>
            )}
            <tr className="border-y border-slate-800 text-base font-bold">
              <td className="py-2">Total</td>
              <td className="py-2 text-right">{money(f.grandTotal, cur)}</td>
            </tr>
            <tr>
              <td className="py-1">Paid</td>
              <td className="py-1 text-right">{money(f.netPaid, cur)}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-1">{f.balance >= 0 ? "Balance due" : "Refund due"}</td>
              <td className="py-1 text-right">{money(Math.abs(f.balance), cur)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        <span className="text-slate-500">Amount in words:</span> <b>{amountInWords(f.grandTotal, cur)}</b>
      </p>

      {b.payments.length > 0 && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Payments received</p>
          <table className="w-full text-sm">
            <tbody>
              {b.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1">{formatDateTime(p.paidAt, s.timezone)}</td>
                  <td className="py-1">
                    {label(p.type)} · {label(p.method)} {p.reference && `(${p.reference})`}
                  </td>
                  <td className="py-1 text-right">
                    {p.type === "refund" ? "− " : ""}
                    {money(p.amount, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-16 flex justify-between text-sm">
        <div className="w-56 border-t border-slate-400 pt-1 text-center">Guest signature</div>
        <div className="w-56 border-t border-slate-400 pt-1 text-center">For {s.hotelName}</div>
      </div>
      <p className="mt-8 text-center text-sm text-slate-600">Thank you for staying with us!</p>
    </>
  );
}

function Confirmation({ b, s }: { b: SerializedBooking; s: HotelSettingsRecord }) {
  const f = b.folio;
  return (
    <>
      <HotelHeader s={s} title="Booking Confirmation" subtitle={`Booking #${b.number}`} />
      <p className="mt-6 text-lg">
        Dear <b>{b.guestName}</b>,
      </p>
      <p className="mt-1">Thank you for choosing {s.hotelName}. We are happy to confirm your booking:</p>
      <div className="mt-4 grid grid-cols-2 gap-x-6 rounded-lg border border-slate-300 p-4">
        <Info label="Booking no.">#{b.number}</Info>
        <Info label="Status">{label(b.status)}</Info>
        <Info label="Arrival">
          {formatDate(b.checkInDate)} from {s.checkInTime}
        </Info>
        <Info label="Departure">
          {formatDate(b.checkOutDate)} by {s.checkOutTime}
        </Info>
        <Info label="Nights">{f.nightCount}</Info>
        <Info label="Room">
          {label(b.room.type)} (Room {b.room.roomNumber})
        </Info>
        <Info label="Guests">
          {b.adults} adult(s){b.children ? `, ${b.children} child(ren)` : ""}
        </Info>
        <Info label="Phone">{b.guest.phone}</Info>
      </div>
      <div className="mt-4 ml-auto w-72 text-sm">
        <div className="flex justify-between py-1">
          <span>Total (incl. tax)</span>
          <b>{formatCurrency(f.grandTotal, s.currency)}</b>
        </div>
        <div className="flex justify-between py-1">
          <span>Advance paid</span>
          <span>{formatCurrency(f.netPaid, s.currency)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-800 py-1 font-bold">
          <span>To pay at hotel</span>
          <span>{formatCurrency(Math.max(0, f.balance), s.currency)}</span>
        </div>
      </div>
      {b.notes && (
        <p className="mt-4 text-sm">
          <span className="text-slate-500">Notes:</span> {b.notes}
        </p>
      )}
      {s.bookingTerms && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Hotel policy</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{s.bookingTerms}</p>
        </div>
      )}
      <p className="mt-8 text-sm">Please carry a valid photo ID for every adult. We look forward to welcoming you!</p>
    </>
  );
}

function Registration({ b, s }: { b: SerializedBooking & { guest: SerializedBooking["guest"] & { dateOfBirth: Date | null } }; s: HotelSettingsRecord }) {
  const g = b.guest;
  const foreign = g.nationality.toLowerCase() !== "indian";
  return (
    <>
      <HotelHeader s={s} title="Guest Registration Card" subtitle={`Booking #${b.number}`} />
      <div className="mt-6 grid grid-cols-2 gap-x-8">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Guest</p>
          <Info label="Full name">{b.guestName}</Info>
          <Info label="Phone">{g.phone}</Info>
          <Info label="Email">{g.email}</Info>
          <Info label="Nationality">{g.nationality}</Info>
          <Info label="Date of birth">{g.dateOfBirth ? formatDate(g.dateOfBirth) : ""}</Info>
          <Info label="Address">{g.address}</Info>
          <Info label="Company">{g.company}</Info>
          <Info label="GSTIN">{g.gstin}</Info>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Stay</p>
          <Info label="Room">
            {b.room.roomNumber} ({label(b.room.type)})
          </Info>
          <Info label="Arrival">{b.actualCheckIn ? formatDateTime(b.actualCheckIn, s.timezone) : formatDate(b.checkInDate)}</Info>
          <Info label="Departure">{formatDate(b.checkOutDate)}</Info>
          <Info label="Guests">
            {b.adults} adult(s){b.children ? `, ${b.children} child(ren)` : ""}
          </Info>
          <Info label="Rate / night">{formatCurrency(b.ratePerNight, s.currency)}</Info>
          <Info label="ID proof">{g.idType ? `${label(g.idType)} ${g.idNumber ?? ""}` : ""}</Info>
        </div>
      </div>
      {foreign && (
        <div className="mt-6 rounded-lg border border-slate-300 p-4">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Foreign national details (for Form C)</p>
          <div className="grid grid-cols-2 gap-x-8">
            <Info label="Passport no.">{g.passportNo}</Info>
            <Info label="Visa no.">{g.visaNo}</Info>
            <Info label="Place of issue">{" "}</Info>
            <Info label="Visa valid till">{" "}</Info>
            <Info label="Arrived in India">{" "}</Info>
            <Info label="Coming from">{" "}</Info>
            <Info label="Next destination">{" "}</Info>
            <Info label="Purpose of visit">{" "}</Info>
          </div>
          <p className="mt-2 text-xs text-slate-500">Submit Form C online at the Bureau of Immigration portal within 24 hours of arrival.</p>
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-x-8">
        {Array.from({ length: Math.max(0, b.adults - 1) }).map((_, i) => (
          <div key={i} className="mb-3 text-sm">
            <p className="text-slate-500">Accompanying guest {i + 1}: name & ID</p>
            <div className="mt-6 border-b border-slate-300" />
          </div>
        ))}
      </div>
      {s.bookingTerms && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">Hotel rules</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{s.bookingTerms}</p>
        </div>
      )}
      <p className="mt-4 text-sm">I confirm that the details above are correct and I agree to the hotel rules.</p>
      <div className="mt-16 flex justify-between text-sm">
        <div className="w-56 border-t border-slate-400 pt-1 text-center">Guest signature</div>
        <div className="w-56 border-t border-slate-400 pt-1 text-center">Front desk</div>
      </div>
    </>
  );
}

export default async function PrintPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { kind, id } = await params;
  if (!["invoice", "confirmation", "registration"].includes(kind)) notFound();

  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) notFound();
  const ctx = await getBillingContext();
  const b = serializeBooking(booking, ctx);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <PrintButton />
      <div className="overflow-x-auto px-2 sm:px-4">
        <div className="print-page mx-auto my-6 min-w-[640px] max-w-3xl rounded-lg bg-white p-6 text-slate-900 shadow sm:p-10">
          {kind === "invoice" && <Invoice b={b} s={ctx.settings} />}
          {kind === "confirmation" && <Confirmation b={b} s={ctx.settings} />}
          {kind === "registration" && <Registration b={b} s={ctx.settings} />}
        </div>
      </div>
    </div>
  );
}
