import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin, csvResponse, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, diffDays, isDateKey } from "@/lib/dates";
import { defaultGroupBy, type GroupBy } from "@/lib/periods";
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

    const asked = searchParams.get("groupBy") as GroupBy | null;
    const groupBy = asked && ["day", "week", "month"].includes(asked) ? asked : type === "daily" ? "day" : defaultGroupBy(from, to);
    const report = await buildReport(ctx, from, to, groupBy);
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
    if (type === "summary" || type === "daily") {
      // Earnings are before GST. RevPAR and cost per room divide by every room in use, sold or not.
      const t = report.totals;
      return csvResponse(`summary_by_${groupBy}_${suffix}`, [
        [
          groupBy === "day" ? "Date" : groupBy === "week" ? "Week starting" : "Month", "Rooms available", "Rooms sold", "Occupancy %",
          "Average price per room sold (ADR)", "Earnings per available room (RevPAR)", "Room earnings", "Extras earnings", "Total earnings",
          "Expenses", "Profit", "Cost per available room", "Profit per available room", "Money received", "Arrivals", "Departures",
        ],
        ...report.groups.map((g) => [
          g.from, g.roomsAvailable, g.roomsSold, g.occupancy, g.adr, g.revpar, g.roomRevenue, g.extrasRevenue, g.revenue,
          g.expenses, g.profit, g.costPerAvailableRoom, g.profitPerAvailableRoom, g.collected, g.arrivals, g.departures,
        ]),
        [
          "Total", t.availableRoomNights, t.roomNightsSold, t.occupancy, t.adr, t.revpar, t.roomRevenue, t.extrasRevenue, t.revenue,
          t.expenses, t.profit, t.costPerAvailableRoom, t.profitPerAvailableRoom, t.collected, report.guests.arrivals, report.guests.departures,
        ],
      ]);
    }
    if (type === "expenses") {
      return csvResponse(`expenses_${suffix}`, [
        ["Date", "Kind of cost", "What for", "Notes", "Paid by", "Amount", "Added by"],
        ...report.expenses.map((e) => [e.date, label(e.category), e.title, e.description, label(e.method), e.amount, e.addedBy]),
        ["", "", "", "", "Total", report.totals.expenses, ""],
      ]);
    }
    if (type === "roomtypes") {
      return csvResponse(`room_types_${suffix}`, [
        ["Room type", "Rooms", "Nights sold", "Occupancy %", "Average price (ADR)", "Earnings per available room (RevPAR)", "Room earnings"],
        ...report.byRoomType.map((r) => [label(r.type), r.rooms, r.nights, r.occupancy, r.adr, r.revpar, r.revenue]),
      ]);
    }
    fail("Unknown report type");
  });
}
