import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { currentHotelId, prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, dateFromKey, isDateKey, todayKey } from "@/lib/dates";
import { round2 } from "@/lib/pricing";
import { logActivity } from "@/lib/activity";
import { assertOnShift } from "@/lib/shift-api";
import { banquetData, banquetFields, banquetItemSchema, moneySchema } from "@/lib/banquet-api";
import { assertHallFree, banquetInclude, banquetLabel, lockHall, nextBanquetNumber, serializeBanquet } from "@/lib/banquets";
import { HOLDING_STATUSES } from "@/lib/banquet-bill";
import { formatCurrency, label } from "@/lib/utils";

/**
 * The list of functions. `view`: upcoming (on hold or confirmed, from today), enquiries, today, unpaid (done, money
 * still owed), past, cancelled or all. Or `from` and `to` for the hall calendar.
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const view = searchParams.get("view") || "upcoming";
    const q = (searchParams.get("q") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.BanquetWhereInput = {};
    let orderBy: Prisma.BanquetOrderByWithRelationInput[] = [{ eventDate: "asc" }, { startTime: "asc" }];
    if (isDateKey(from) && isDateKey(to)) {
      where.eventDate = { gte: dateFromKey(from), lte: dateFromKey(to) };
      where.status = { not: "cancelled" };
    } else if (view === "upcoming") {
      where.eventDate = { gte: dateFromKey(today) };
      where.status = { in: ["tentative", "confirmed"] };
    } else if (view === "enquiries") {
      where.status = "enquiry";
      where.eventDate = { gte: dateFromKey(addDays(today, -1)) };
      orderBy = [{ followUpOn: { sort: "asc", nulls: "last" } }, { eventDate: "asc" }];
    } else if (view === "today") {
      where.eventDate = dateFromKey(today);
      where.status = { not: "cancelled" };
    } else if (view === "unpaid") {
      where.status = { in: ["confirmed", "completed"] };
      where.eventDate = { lte: dateFromKey(today) };
    } else if (view === "past") {
      where.OR = [{ status: "completed" }, { eventDate: { lt: dateFromKey(today) }, status: { not: "cancelled" } }];
      orderBy = [{ eventDate: "desc" }, { startTime: "desc" }];
    } else if (view === "cancelled") {
      where.status = "cancelled";
      orderBy = [{ eventDate: "desc" }];
    } else {
      orderBy = [{ eventDate: "desc" }];
    }
    if (q) {
      const num = Number(q.replace(/^#/, ""));
      where.AND = [
        {
          OR: [
            ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
            { customerName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { company: { contains: q, mode: "insensitive" as const } },
            { eventName: { contains: q, mode: "insensitive" as const } },
          ],
        },
      ];
    }
    const rows = (await prisma.banquet.findMany({ where, include: banquetInclude, orderBy, take: 500 })).map(serializeBanquet);
    return NextResponse.json(view === "unpaid" ? rows.filter((b) => b.bill.balance > 0.5) : rows);
  });
}

const createSchema = banquetFields.extend({
  status: z.enum(["enquiry", "tentative", "confirmed"]).default("enquiry"),
  items: z.array(banquetItemSchema).max(50).default([]),
  advance: moneySchema.nullable().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    await assertOnShift(user);
    const body = createSchema.parse(await request.json());
    const { status, items, advance, ...fields } = body;
    if (advance && status === "enquiry") fail("Take the advance when the function is put on hold or confirmed");

    const banquet = await prisma.$transaction(async (tx) => {
      const hall = await tx.banquetHall.findUnique({ where: { id: fields.hallId } });
      if (!hall || !hall.active) fail("Please choose a hall that is in use");
      await lockHall(tx, hall.id);
      if (HOLDING_STATUSES.includes(status)) {
        await assertHallFree(tx, { hallId: hall.id, date: fields.eventDate, start: fields.startTime, end: fields.endTime });
      }
      const created = await tx.banquet.create({
        data: {
          hotelId: currentHotelId(),
          number: await nextBanquetNumber(tx),
          status,
          ...banquetData(fields),
          createdById: user.id,
          createdByName: user.name,
          items: {
            create: items.map((i) => ({ hotelId: currentHotelId(), ...i, amount: round2(i.quantity * i.unitPrice) })),
          },
        },
      });
      if (advance) {
        await tx.payment.create({
          data: {
            hotelId: currentHotelId(),
            banquetId: created.id,
            amount: advance.amount,
            method: advance.method,
            type: "advance",
            reference: advance.reference,
            receivedBy: user.name,
          },
        });
      }
      return tx.banquet.findUniqueOrThrow({ where: { id: created.id }, include: banquetInclude });
    });

    const settings = await getSettings();
    const b = serializeBanquet(banquet);
    await logActivity(
      user,
      status === "enquiry" ? "Function enquiry" : "Function booked",
      `${banquetLabel(banquet)}: ${label(banquet.eventType)}, ${banquet.expectedPax} guests, ${label(status)}, total ${formatCurrency(b.bill.total, settings.currency)}`
    );
    if (advance) await logActivity(user, "Payment received", `${banquetLabel(banquet)}: ${advance.amount} by ${label(advance.method)}`);
    return NextResponse.json(b, { status: 201 });
  });
}
