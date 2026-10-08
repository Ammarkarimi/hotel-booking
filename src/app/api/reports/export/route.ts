import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin, csvResponse, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, diffDays, isDateKey } from "@/lib/dates";
import { buildReport } from "@/lib/reports";
import { bookingInclude, serializeBooking } from "@/lib/bookings";
import { label } from "@/lib/utils";

/** Downloads a spreadsheet (CSV) that opens in Excel or Google Sheets. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bookings";
    const ctx = await getBillingContext();
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : ctx.today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : addDays(to, -29);
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    const suffix = `${from}_to_${to}.csv`;

    if (type === "bookings") {
      const bookings = await prisma.booking.findMany({
        where: { checkInDate: { gte: dateFromKey(from), lt: dateFromKey(addDays(to, 1)) } },
        include: bookingInclude,
        orderBy: { checkInDate: "asc" },
      });
      const rows = bookings.map((b) => serializeBooking(b, ctx));
      return csvResponse(`bookings_${suffix}`, [
        ["Booking #", "Guest", "Phone", "Room", "Arrival", "Leaving", "Nights", "Status", "Source", "Room total", "Discount", "Extras", "Tax", "Total", "Paid", "Balance"],
        ...rows.map((b) => [
          b.number, b.guestName, b.guest.phone, b.room.roomNumber, b.checkInDate, b.checkOutDate, b.folio.nightCount,
          label(b.status), label(b.source), b.folio.roomTotal, b.folio.discount, b.folio.extrasTotal, b.folio.taxTotal,
          b.folio.grandTotal, b.folio.netPaid, b.folio.balance,
        ]),
      ]);
    }

    const report = await buildReport(ctx, from, to);
    if (type === "payments") {
      return csvResponse(`payments_${suffix}`, [
        ["Date", "Booking #", "Guest", "Room", "Type", "Method", "Amount", "Reference", "Received by"],
        ...report.payments.map((p) => [
          new Date(p.paidAt).toLocaleString("en-IN", { timeZone: ctx.settings.timezone }), p.bookingNumber, p.guestName, p.room,
          label(p.type), label(p.method), p.type === "refund" ? -p.amount : p.amount, p.reference, p.receivedBy,
        ]),
      ]);
    }
    if (type === "invoices") {
      return csvResponse(`gst_invoices_${suffix}`, [
        ["Invoice #", "Date", "Guest", "Guest GSTIN", "Room", "Taxable value", "CGST", "SGST", "Total tax", "Invoice total"],
        ...report.invoices.map((i) => [
          i.invoiceNumber, i.date, i.guestName, i.guestGstin, i.room, i.taxable,
          Math.round((i.tax / 2) * 100) / 100, Math.round((i.tax / 2) * 100) / 100, i.tax, i.total,
        ]),
      ]);
    }
    if (type === "daily") {
      return csvResponse(`daily_${suffix}`, [
        ["Date", "Rooms sold", "Occupancy %", "Room revenue", "Money collected"],
        ...report.series.map((d) => [d.date, d.roomsSold, d.occupancy, d.roomRevenue, d.collected]),
      ]);
    }
    fail("Unknown report type");
  });
}
