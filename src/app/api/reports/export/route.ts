import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withModuleAdmin, csvResponse, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { addDays, dateFromKey, diffDays, isDateKey, todayKey } from "@/lib/dates";
import { parseTallyLedgers, tallyMastersXml, tallyVouchersXml } from "@/lib/tally";
import { defaultGroupBy, type GroupBy } from "@/lib/periods";
import { buildReport } from "@/lib/reports";
import { bookingInclude, serializeBooking } from "@/lib/bookings";
import { round2 } from "@/lib/pricing";
import { label } from "@/lib/utils";

const sum = (values: number[]) => round2(values.reduce((s, v) => s + v, 0));

/** Downloads a spreadsheet (CSV) that opens in Excel or Google Sheets. */
export async function GET(request: NextRequest) {
  return withModuleAdmin("reports", async () => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bookings";
    const ctx = await getBillingContext();
    const to = isDateKey(searchParams.get("to")) ? searchParams.get("to")! : ctx.today;
    const from = isDateKey(searchParams.get("from")) ? searchParams.get("from")! : addDays(to, -29);
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    const suffix = `${from}_to_${to}.csv`;

    if (type === "tally_masters" || type === "tally_vouchers") {
      // Files for Tally: the ledgers first (Import → Masters), then the vouchers (Import → Transactions).
      const local = (d: Date) => todayKey(ctx.settings.timezone, d);
      const widened = { gte: dateFromKey(addDays(from, -1)), lt: dateFromKey(addDays(to, 2)) };
      const [bills, payments] = await Promise.all([
        prisma.bill.findMany({ where: { generatedAt: widened, invoiceNumber: { not: null } }, include: { booking: { include: { guest: true, room: true } } }, orderBy: { generatedAt: "asc" } }),
        prisma.payment.findMany({ where: { status: "completed", paidAt: widened }, include: { booking: { include: { guest: true, bill: true } } }, orderBy: { paidAt: "asc" } }),
      ]);
      const inRange = (d: Date) => local(d) >= from && local(d) <= to;
      const data = {
        company: ctx.settings.hotelName,
        ledgers: parseTallyLedgers(ctx.settings.tallyLedgers),
        invoices: bills.filter((b) => inRange(b.generatedAt)).map((b) => ({
          id: b.id,
          invoiceNumber: b.invoiceNumber!,
          date: local(b.generatedAt),
          bookingNumber: b.booking.number,
          guestName: `${b.booking.guest.firstName} ${b.booking.guest.lastName}`.trim(),
          company: b.booking.guest.company,
          gstin: b.booking.guest.gstin,
          state: b.booking.guest.state,
          room: b.booking.room.roomNumber,
          roomTaxable: round2(b.roomCharges - b.discount),
          extrasTaxable: b.additionalCharges,
          tax: b.taxAmount,
        })),
        payments: payments.filter((p) => inRange(p.paidAt)).map((p) => ({
          id: p.id,
          date: local(p.paidAt),
          bookingNumber: p.booking.number,
          invoiceNumber: p.booking.bill?.invoiceNumber ?? null,
          guestName: `${p.booking.guest.firstName} ${p.booking.guest.lastName}`.trim(),
          company: p.booking.guest.company,
          gstin: p.booking.guest.gstin,
          amount: p.amount,
          method: p.method,
          type: p.type,
          reference: p.reference,
        })),
      };
      const masters = type === "tally_masters";
      return new NextResponse(masters ? tallyMastersXml(data) : tallyVouchersXml(data), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="tally_${masters ? "1_ledgers" : "2_vouchers"}_${from}_to_${to}.xml"`,
        },
      });
    }

    if (type === "bookings") {
      const bookings = await prisma.booking.findMany({
        where: { checkInDate: { gte: dateFromKey(from), lt: dateFromKey(addDays(to, 1)) } },
        include: bookingInclude,
        orderBy: { checkInDate: "asc" },
      });
      const rows = bookings.map((b) => serializeBooking(b, ctx));
      // First total = at the price first agreed; Final total = after Edit bill; Difference = final - first.
      return csvResponse(`bookings_${suffix}`, [
        [
          "Booking #", "Guest", "Phone", "Room", "Arrival", "Leaving", "Nights", "Status", "Source", "Room total", "Discount", "Extras", "Tax",
          "First total (as first agreed)", "Final total (after edit)", "Difference", "Paid", "Balance",
        ],
        ...rows.map((b) => [
          b.number, b.guestName, b.guest.phone, b.room.roomNumber, b.checkInDate, b.checkOutDate, b.folio.nightCount,
          label(b.status), label(b.source), b.folio.roomTotal, b.folio.discount, b.folio.extrasTotal, b.folio.taxTotal,
          b.firstTotal, b.folio.grandTotal, round2(b.folio.grandTotal - b.firstTotal), b.folio.netPaid, b.folio.balance,
        ]),
        [
          "Total", "", "", "", "", "", "", "", "", "", "", "", "",
          sum(rows.map((b) => b.firstTotal)), sum(rows.map((b) => b.folio.grandTotal)), sum(rows.map((b) => b.folio.grandTotal - b.firstTotal)), "", "",
        ],
      ]);
    }

    const asked = searchParams.get("groupBy") as GroupBy | null;
    const groupBy = asked && ["day", "week", "month"].includes(asked) ? asked : type === "daily" ? "day" : defaultGroupBy(from, to);
    const report = await buildReport(ctx, from, to, groupBy);
    if (type === "payments") {
      return csvResponse(`payments_${suffix}`, [
        ["Date", "Booking #", "Guest", "Room", "Type", "Method", "Amount", "Reference", "Received by"],
        ...report.payments.map((p) => [
          // "2026-11-03 21:17": the hotel's own time, in a form Excel reads as a date.
          new Date(p.paidAt).toLocaleString("sv-SE", { timeZone: ctx.settings.timezone }).slice(0, 16), p.bookingNumber, p.guestName, p.room,
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
          "Expenses", "Booking site commission", "Profit", "Cost per available room", "Profit per available room", "Money received", "Arrivals", "Departures",
        ],
        ...report.groups.map((g) => [
          g.from, g.roomsAvailable, g.roomsSold, g.occupancy, g.adr, g.revpar, g.roomRevenue, g.extrasRevenue, g.revenue,
          g.expenses, g.commission, g.profit, g.costPerAvailableRoom, g.profitPerAvailableRoom, g.collected, g.arrivals, g.departures,
        ]),
        [
          "Total", t.availableRoomNights, t.roomNightsSold, t.occupancy, t.adr, t.revpar, t.roomRevenue, t.extrasRevenue, t.revenue,
          t.expenses, t.otaFees, t.profit, t.costPerAvailableRoom, t.profitPerAvailableRoom, t.collected, report.guests.arrivals, report.guests.departures,
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
    if (type === "payouts") {
      // One row per booking-site stay leaving in the period, to tick off against the site's own statement.
      const r = report.payouts;
      return csvResponse(`booking_site_payouts_${suffix}`, [
        [
          "Booking site", "Their booking ID", "Our booking #", "Guest", "Room", "Arrival", "Leaving", "Nights", "Status",
          "Taxable value", "GST", "Bill total (gross)", "Commission", "GST on commission", "TCS", "TDS", "Other deductions",
          "Site pays us (net)", "Payout", "Received on", "Bank reference",
        ],
        ...r.rows.map((p) => [
          label(p.source), p.otaReference, p.number, p.guestName, p.room, p.checkIn, p.checkOut, p.nights, label(p.status),
          p.taxable, p.gst, p.gross,
          p.entered ? p.commission : "", p.entered ? p.commissionGst : "", p.entered ? p.tcs : "", p.entered ? p.tds : "", p.entered ? p.other : "",
          p.net ?? "", p.entered ? (p.received ? "Received" : "Waiting") : "Not entered", p.receivedOn, p.bankRef,
        ]),
        [
          "Total", "", "", "", "", "", "", "", "", "", "", r.totals.gross, "", "", "", "", "",
          r.totals.net, `Received ${r.totals.received}, waiting ${r.totals.waiting}`, "", "",
        ],
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
