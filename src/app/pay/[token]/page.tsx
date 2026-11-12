import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CheckCircle2, CreditCard, MessageCircle, Smartphone } from "lucide-react";
import { prisma, rawPrisma, runForHotel } from "@/lib/db";
import { getBillingContext } from "@/lib/settings";
import { bookingInclude, folioFor, groupOf } from "@/lib/bookings";
import { toDateKey } from "@/lib/dates";
import { amountToPay, onlinePaymentWays, upiNote, upiPayLink } from "@/lib/online-payments";
import { razorpayKeys, recordLinkPayments, syncPaymentLinks } from "@/lib/payment-links";
import { fetchLink, verifyCallback } from "@/lib/razorpay";
import { formatCurrency, formatDate, label } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay for your stay", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** The guest's payment page, sent on WhatsApp: UPI QR to the hotel's own UPI ID and/or a Razorpay button. */
export default async function PayPage({ params, searchParams }: Props) {
  const { token } = await params;
  const q = await searchParams;
  const found = await rawPrisma.booking.findUnique({ where: { publicToken: token }, select: { id: true, hotelId: true, hotel: { select: { status: true, slug: true } } } });
  if (!found) notFound();

  const data = await runForHotel(found.hotelId, async () => {
    const ctx = await getBillingContext();
    let justPaid = false;
    let failedReturn = false;
    // Back from Razorpay: check the signature, then ask Razorpay and write the payment down.
    if (q.razorpay_payment_link_id) {
      const keys = razorpayKeys(ctx.settings);
      const link = await prisma.paymentLink.findUnique({ where: { linkId: q.razorpay_payment_link_id } });
      const signed =
        !!keys &&
        !!link &&
        link.bookingId === found.id &&
        verifyCallback(keys.keySecret, {
          linkId: q.razorpay_payment_link_id,
          reference: q.razorpay_payment_link_reference_id ?? "",
          status: q.razorpay_payment_link_status ?? "",
          paymentId: q.razorpay_payment_id ?? "",
          signature: q.razorpay_signature ?? "",
        });
      if (signed && keys && link) {
        const remote = await fetchLink(keys, link.linkId).catch(() => null);
        if (remote) await recordLinkPayments(link, remote, ctx);
        justPaid = remote?.status === "paid";
        failedReturn = !justPaid;
      }
    } else {
      await syncPaymentLinks(found.id, ctx).catch(() => 0);
    }
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: found.id }, include: bookingInclude });
    // Rooms booked together are paid together.
    const group = await groupOf(booking, ctx);
    const folio = folioFor(booking, ctx);
    const totals = group ? { total: group.total, paid: group.paid, balance: group.balance } : { total: folio.grandTotal, paid: folio.netPaid, balance: folio.balance };
    return { ctx, booking, group, totals, justPaid, failedReturn };
  });

  const { ctx, booking, group, totals } = data;
  const s = ctx.settings;
  const ways = onlinePaymentWays(s);
  const amount = amountToPay(totals.balance, q.a);
  const closed = found.hotel.status !== "active" || ["cancelled", "no_show"].includes(booking.status);
  const upiLink = ways.upi && amount > 0 ? upiPayLink({ upiId: s.upiId!, name: s.upiName || s.hotelName, amount, note: upiNote(booking.number, s.hotelName) }) : null;
  const qr = upiLink ? await QRCode.toString(upiLink, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const hotelWhatsapp = (s.phone ?? "").replace(/\D/g, "");
  const screenshotLink = hotelWhatsapp
    ? `https://wa.me/${hotelWhatsapp.length === 10 ? `91${hotelWhatsapp}` : hotelWhatsapp}?text=${encodeURIComponent(`I have paid ${formatCurrency(amount, s.currency)} by UPI for booking #${booking.number}. Screenshot attached.`)}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">{s.hotelName}</h1>
          {s.city && <p className="text-slate-500">{s.city}</p>}
        </div>

        {data.justPaid && (
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200" role="status">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <p className="font-bold">Payment received. Thank you!</p>
              <p className="text-sm">The hotel can see it on your booking. You do not need to send a screenshot.</p>
            </div>
          </div>
        )}
        {q.e && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200" role="alert">
            {q.e.slice(0, 200)}
          </div>
        )}
        {data.failedReturn && (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
            The payment did not go through. No money was taken for this attempt. You can try again below.
          </div>
        )}

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Booking #{booking.number}</p>
          <p className="text-lg font-semibold">{booking.guest.firstName}</p>
          <p className="text-slate-600">
            {group ? `${group.rooms.filter((r) => !["cancelled", "no_show"].includes(r.status)).length} rooms` : `${label(booking.room.type)} room`} ·{" "}
            {formatDate(toDateKey(booking.checkInDate))} → {formatDate(toDateKey(booking.checkOutDate))}
          </p>
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-slate-600">Total</dt>
              <dd>{formatCurrency(totals.total, s.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Paid</dt>
              <dd>{formatCurrency(totals.paid, s.currency)}</dd>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <dt>{amount > 0 && amount < totals.balance - 0.5 ? "Advance to pay now" : "To pay"}</dt>
              <dd className="text-primary-700">{formatCurrency(amount, s.currency)}</dd>
            </div>
          </dl>
        </div>

        {closed ? (
          <p className="rounded-2xl bg-white p-5 text-center text-slate-600 ring-1 ring-slate-200">This booking cannot be paid online. Please contact the hotel.</p>
        ) : amount <= 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center font-semibold text-emerald-700 ring-1 ring-slate-200">Nothing left to pay. Thank you!</p>
        ) : !ways.any ? (
          <p className="rounded-2xl bg-white p-5 text-center text-slate-600 ring-1 ring-slate-200">Online payment is not available. Please pay at the hotel.</p>
        ) : (
          <>
            {ways.razorpay && (
              <form method="post" action={`/api/public/pay/${token}`} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <input type="hidden" name="a" value={amount} />
                <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-base font-bold text-white hover:bg-primary-700">
                  <CreditCard className="h-5 w-5" /> Pay {formatCurrency(amount, s.currency)} online
                </button>
                <p className="mt-2 text-center text-sm text-slate-500">UPI, debit or credit card, or net banking. Secured by Razorpay.</p>
              </form>
            )}
            {upiLink && qr && (
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold">{ways.razorpay ? "Or pay by UPI to the hotel" : "Pay by UPI"}</p>
                <div className="mx-auto mt-3 w-56" aria-label="UPI QR code" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
                <p className="mt-2 text-sm text-slate-600">Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM).</p>
                <a
                  href={upiLink}
                  className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-bold text-white hover:bg-emerald-700"
                >
                  <Smartphone className="h-5 w-5" /> Open UPI app on this phone
                </a>
                <p className="mt-3 text-sm text-slate-500">
                  UPI ID: <span className="font-semibold text-slate-800">{s.upiId}</span>
                </p>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  After paying by UPI, please send the payment screenshot to the hotel so they can mark it as paid.
                </p>
                {screenshotLink && (
                  <a href={screenshotLink} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
                    <MessageCircle className="h-4 w-4" /> Send it on WhatsApp
                  </a>
                )}
              </div>
            )}
          </>
        )}
        {s.phone && <p className="text-center text-sm text-slate-500">Questions? Call the hotel on {s.phone}.</p>}
      </div>
    </main>
  );
}
