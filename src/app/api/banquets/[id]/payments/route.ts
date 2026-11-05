import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { moneySchema } from "@/lib/banquet-api";
import { banquetLabel, loadBanquet, serializeBanquet } from "@/lib/banquets";
import { banquetBill } from "@/lib/banquet-bill";
import { formatCurrency, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const schema = moneySchema.extend({ refund: z.boolean().default(false), notes: z.string().trim().max(200).optional() });

/** Money from the customer (advance or balance), or money given back. Counted in Payments, the cash drawer and shifts. */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const banquet = await loadBanquet(id);
    const bill = banquetBill(banquet);
    const { currency } = await getSettings();
    if (banquet.status === "cancelled" && !body.refund) fail("This function is cancelled");
    if (banquet.status === "enquiry" && !body.refund) fail("Put the function on hold or confirm it before taking an advance");
    if (body.refund && body.amount > bill.netPaid + 0.01) fail(`You can give back at most ${formatCurrency(bill.netPaid, currency)} (the amount received)`);

    await prisma.payment.create({
      data: {
        hotelId: currentHotelId(),
        banquetId: id,
        amount: body.amount,
        method: body.method,
        type: body.refund ? "refund" : banquet.status === "completed" ? "balance" : "advance",
        reference: body.reference,
        notes: body.notes || null,
        receivedBy: user.name,
      },
    });
    await logActivity(user, body.refund ? "Refund given" : "Payment received", `${banquetLabel(banquet)}: ${body.amount} by ${label(body.method)}`);
    return NextResponse.json(serializeBanquet(await loadBanquet(id)), { status: 201 });
  });
}
