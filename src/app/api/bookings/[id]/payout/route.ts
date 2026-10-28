import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAdmin, fail } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { dateFromKey, isDateKey } from "@/lib/dates";
import { bookingLabel, loadBooking, serializeBooking } from "@/lib/bookings";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const amount = (what: string) => z.coerce.number().min(0, `${what} cannot be less than zero`).max(100_000_000, `Please check ${what.toLowerCase()}`).default(0);

const payoutSchema = z.object({
  otaReference: z.string().trim().max(60).optional().default(""),
  // null clears the payout (e.g. entered on the wrong booking)
  payoutAmount: z.coerce.number().min(0, "The amount the site pays cannot be less than zero").max(100_000_000).nullable(),
  payoutCommission: amount("Commission"),
  payoutCommissionGst: amount("GST on commission"),
  payoutTcs: amount("TCS"),
  payoutTds: amount("TDS"),
  payoutReceivedOn: z.string().refine(isDateKey, "Please choose the date the money arrived").nullable().optional().default(null),
  payoutBankRef: z.string().trim().max(60).optional().default(""),
});

/** The booking site's payout for a booking. Owner only: commission and payouts are business figures. */
export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = payoutSchema.parse(await request.json());
    const ctx = await getBillingContext();
    const booking = await loadBooking(id);
    if (body.payoutReceivedOn && body.payoutReceivedOn > ctx.today) fail("The date the money arrived cannot be in the future");
    if (body.payoutReceivedOn && body.payoutAmount === null) fail("Enter the amount the site pays before marking it received");

    await prisma.booking.update({
      where: { id },
      data: {
        otaReference: body.otaReference || null,
        payoutAmount: body.payoutAmount,
        payoutCommission: body.payoutAmount === null ? 0 : body.payoutCommission,
        payoutCommissionGst: body.payoutAmount === null ? 0 : body.payoutCommissionGst,
        payoutTcs: body.payoutAmount === null ? 0 : body.payoutTcs,
        payoutTds: body.payoutAmount === null ? 0 : body.payoutTds,
        payoutReceivedOn: body.payoutReceivedOn ? dateFromKey(body.payoutReceivedOn) : null,
        payoutBankRef: body.payoutBankRef || null,
      },
    });
    const details =
      body.payoutAmount === null
        ? "payout cleared"
        : `site pays ${formatCurrency(body.payoutAmount, ctx.settings.currency)}${body.payoutReceivedOn ? `, received ${body.payoutReceivedOn}` : ", waiting"}`;
    await logActivity(user, "Booking site payout", `${bookingLabel(booking)}: ${details}`);
    return NextResponse.json(serializeBooking(await loadBooking(id), ctx));
  });
}
