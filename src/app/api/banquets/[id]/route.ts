import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, isAdmin, withAdmin, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { dateFromKey, isDateKey, toDateKey, todayKey } from "@/lib/dates";
import { round2 } from "@/lib/pricing";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { banquetData, banquetFields, moneySchema } from "@/lib/banquet-api";
import { assertHallFree, banquetLabel, loadBanquet, lockHall, serializeBanquet } from "@/lib/banquets";
import { banquetBill, banquetInvoiceNumber, HOLDING_STATUSES, type BanquetStatus } from "@/lib/banquet-bill";
import { formatCurrency, label, PAYMENT_METHODS } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    return NextResponse.json(serializeBanquet(await loadBanquet(id)));
  });
}

const schema = z.discriminatedUnion("action", [
  // Change the details. After the final bill only the owner can; money paid above the new total is then given back.
  banquetFields.extend({ action: z.literal("edit"), reason: z.string().trim().max(200).optional(), refundMethod: z.enum(PAYMENT_METHODS).optional() }),
  z.object({ action: z.literal("status"), status: z.enum(["enquiry", "tentative", "confirmed"]), followUpOn: z.string().nullable().optional() }),
  // After the function: the plates served, then the final bill (a numbered tax invoice).
  z.object({ action: z.literal("complete"), actualPax: z.coerce.number().int().min(0).max(20000) }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(1, "Please write why the function is cancelled").max(300), refund: moneySchema.nullable().optional() }),
]);

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const money = (n: number) => formatCurrency(n, settings.currency);

    const { banquet, log } = await prisma.$transaction(async (tx) => {
      const old = await loadBanquet(id, tx);
      if (old.status === "cancelled") fail("This function is cancelled. Make a new one if it is back on.");
      const before = banquetBill(old);
      const log: [string, string][] = [];

      if (body.action === "edit") {
        const { action: _a, reason, refundMethod, ...fields } = body;
        if (old.status === "completed" && !isAdmin(user)) fail("Only the owner can change a function after its final bill", 403);
        const hall = await tx.banquetHall.findUnique({ where: { id: fields.hallId } });
        if (!hall) fail("Please choose the hall");
        if (hall.id !== old.hallId && !hall.active) fail("This hall is switched off. Choose a hall that is in use.");
        await lockHall(tx, hall.id);
        if (HOLDING_STATUSES.includes(old.status as BanquetStatus)) {
          await assertHallFree(tx, { hallId: hall.id, date: fields.eventDate, start: fields.startTime, end: fields.endTime, exceptId: id });
        }
        await tx.banquet.update({ where: { id }, data: banquetData(fields) });
        const fresh = await loadBanquet(id, tx);
        const after = banquetBill(fresh);
        log.push(["Function changed", `${banquetLabel(fresh)}: total ${money(before.total)} → ${money(after.total)}${reason ? `. Reason: ${reason}` : ""}`]);
        if (old.status === "completed" && after.balance < -0.5) {
          if (!refundMethod) fail("Please choose how the extra money was given back to the customer");
          const amount = round2(-after.balance);
          await tx.payment.create({
            data: { hotelId: currentHotelId(), banquetId: id, amount, method: refundMethod, type: "refund", reference: "Bill changed", notes: reason || null, receivedBy: user.name },
          });
          log.push(["Refund given", `${banquetLabel(fresh)}: ${amount} by ${label(refundMethod)} (bill changed)`]);
        }
      } else if (body.action === "status") {
        if (old.status === "completed") fail("This function already has its final bill");
        if (body.status === "enquiry" && old.payments.length > 0 && before.netPaid > 0) {
          fail("An advance has been paid, so the hall stays held. Cancel the function to give the advance back.");
        }
        if (HOLDING_STATUSES.includes(body.status)) {
          await lockHall(tx, old.hallId);
          await assertHallFree(tx, { hallId: old.hallId, date: toDateKey(old.eventDate), start: old.startTime, end: old.endTime, exceptId: id });
        }
        await tx.banquet.update({
          where: { id },
          data: { status: body.status, ...(body.followUpOn !== undefined && { followUpOn: isDateKey(body.followUpOn) ? dateFromKey(body.followUpOn) : null }) },
        });
        const names: Record<string, string> = { enquiry: "Function back to enquiry", tentative: "Function on hold", confirmed: "Function confirmed" };
        log.push([names[body.status], banquetLabel(old)]);
      } else if (body.action === "complete") {
        if (old.status !== "confirmed" && old.status !== "tentative") fail("Confirm the function before making its final bill");
        if (toDateKey(old.eventDate) > today) fail("The final bill can be made on the day of the function or after it");
        await tx.banquet.update({
          where: { id },
          data: { status: "completed", actualPax: body.actualPax, invoiceNumber: banquetInvoiceNumber(settings.banquetPrefix, old.number), billedAt: new Date() },
        });
        const fresh = await loadBanquet(id, tx);
        log.push(["Function billed", `${banquetLabel(fresh)}: ${body.actualPax} plates served, invoice ${fresh.invoiceNumber}, total ${money(banquetBill(fresh).total)}`]);
      } else {
        if (old.status === "completed") fail("This function already has its final bill. The owner can change the bill instead.");
        if (body.refund) {
          if (body.refund.amount > before.netPaid + 0.01) fail(`You can give back at most ${money(before.netPaid)} (the amount received)`);
          await tx.payment.create({
            data: { hotelId: currentHotelId(), banquetId: id, amount: body.refund.amount, method: body.refund.method, type: "refund", reference: body.refund.reference || "Cancelled", receivedBy: user.name },
          });
        }
        await tx.banquet.update({ where: { id }, data: { status: "cancelled", cancelReason: body.reason, cancelledAt: new Date() } });
        const kept = round2(before.netPaid - (body.refund?.amount ?? 0));
        log.push([
          "Function cancelled",
          `${banquetLabel(old)}: ${body.reason}${body.refund ? `. Given back ${money(body.refund.amount)} by ${label(body.refund.method)}` : ""}${kept > 0 ? `. Kept ${money(kept)} as cancellation charge` : ""}`,
        ]);
      }
      return { banquet: await loadBanquet(id, tx), log };
    });

    for (const [action, details] of log) await logActivity(user, action, details);
    return NextResponse.json(serializeBanquet(banquet));
  });
}

/** Owner only: removes a function made by mistake, with its items and payments. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const banquet = await loadBanquet(id);
    if (banquet.invoiceNumber) fail("A function with a final bill cannot be deleted (its invoice must stay). Change the bill instead.");
    await prisma.banquet.delete({ where: { id } });
    await logActivity(user, "Function deleted", banquetLabel(banquet));
    return NextResponse.json({ success: true });
  });
}
