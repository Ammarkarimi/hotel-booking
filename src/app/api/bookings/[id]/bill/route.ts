import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { bookingLabel, folioFor, loadBooking, serializeBooking } from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { formatCurrency } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// Edit bill: the price agreed with the guest changes (they bargained at check-out, for example).
// Staff can edit while the guest is staying; after check-out only the owner can. A final invoice keeps its number and
// gets the new amounts. Payments are not touched: a refund or a payment is recorded as usual.
const schema = z.object({
  ratePerNight: z.coerce.number().min(0, "The price cannot be less than 0").max(10_00_000),
  discount: z.coerce.number().min(0, "The discount cannot be less than 0").default(0),
  // GST % on the room; null = the default from Settings.
  gstRate: z.coerce.number().min(0, "GST cannot be less than 0%").max(40, "Please check the GST %").nullable(),
  reason: z.string().trim().max(200).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const ctx = await getBillingContext();

    const { before, after, booking } = await prisma.$transaction(async (tx) => {
      const old = await loadBooking(id, tx);
      if (!["checked_in", "checked_out"].includes(old.status)) fail("The bill can be edited once the guest has checked in. Before that, use Change booking.");
      // Once the guest has left, only the owner can change the bill.
      if (old.status === "checked_out" && !isAdmin(user)) fail("Only the owner can edit the bill after check-out", 403);
      const before = folioFor(old, ctx);

      await tx.booking.update({
        where: { id },
        data: {
          ratePerNight: body.ratePerNight,
          // The price agreed with the guest is kept for every night (no weekend or season changes).
          fixedRate: true,
          discount: body.discount,
          gstRate: body.gstRate,
        },
      });
      const fresh = await loadBooking(id, tx);
      const after = folioFor({ ...fresh, bill: null }, ctx);
      if (body.discount > after.roomTotal) fail("The discount is more than the room price");

      if (fresh.bill) {
        // The final invoice: same number, new amounts.
        await tx.bill.update({
          where: { bookingId: id },
          data: {
            roomCharges: after.roomTotal,
            additionalCharges: after.extrasTotal,
            discount: after.discount,
            taxRate: after.roomTaxRate,
            roomTax: after.roomTax,
            extrasTax: after.extrasTax,
            taxAmount: after.taxTotal,
            totalAmount: after.grandTotal,
            nights: after.nightCount,
          },
        });
      }
      return { before, after, booking: await loadBooking(id, tx) };
    });

    const money = (n: number) => formatCurrency(n, ctx.settings.currency);
    await logActivity(
      user,
      "Bill edited",
      `${bookingLabel(booking)}: total ${money(before.grandTotal)} → ${money(after.grandTotal)} (${money(body.ratePerNight)} a night${body.discount ? `, discount ${money(body.discount)}` : ""})${body.reason ? `. Reason: ${body.reason}` : ""}`
    );
    return NextResponse.json(serializeBooking(booking, ctx));
  });
}
