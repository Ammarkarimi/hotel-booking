import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { dateFromKey, isDateKey } from "@/lib/dates";
import { withPlatform } from "@/lib/platform";
import { SUBSCRIPTION_METHODS, platformHotelDetail, platformToday } from "@/lib/platform-hotels";
import { addMonths, isMonth } from "@/lib/subscription";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  month: z.string().refine(isMonth, "Choose the month this payment is for"),
  months: z.coerce.number().int().min(1).max(24).default(1),
  amount: z.coerce.number().positive("Enter the amount received"),
  method: z.enum(SUBSCRIPTION_METHODS).default("upi"),
  clearsMonth: z.boolean().default(true),
  paidOn: z.string().optional(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

/** Records money received from a hotel. `months` > 1 splits one payment across several months. */
export async function POST(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const hotel = await rawPrisma.hotel.findUnique({ where: { id } });
    if (!hotel) fail("Hotel not found", 404);
    const paidOn = isDateKey(body.paidOn) ? body.paidOn : platformToday();
    const perMonth = Math.round((body.amount / body.months) * 100) / 100;
    // Any rounding difference goes on the first month so the total matches what was received.
    const firstMonth = Math.round((body.amount - perMonth * (body.months - 1)) * 100) / 100;

    await rawPrisma.subscriptionPayment.createMany({
      data: Array.from({ length: body.months }, (_, i) => ({
        hotelId: id,
        month: addMonths(body.month, i),
        amount: i === 0 ? firstMonth : perMonth,
        clearsMonth: body.clearsMonth,
        method: body.method,
        paidOn: dateFromKey(paidOn),
        reference: body.reference || null,
        notes: body.notes || null,
      })),
    });
    return NextResponse.json(await platformHotelDetail(id), { status: 201 });
  });
}
