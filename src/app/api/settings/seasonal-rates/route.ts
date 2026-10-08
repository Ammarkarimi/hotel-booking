import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentHotelId, prisma } from "@/lib/db";
import { withAdmin, fail } from "@/lib/api";
import { dateFromKey, isDateKey } from "@/lib/dates";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  name: z.string().trim().min(1, "Give this price change a name, e.g. Diwali"),
  startDate: z.string().refine(isDateKey, "Choose a start date"),
  endDate: z.string().refine(isDateKey, "Choose an end date"),
  roomType: z.string().trim().optional().nullable(),
  percent: z.coerce.number().min(-90, "Cannot reduce by more than 90%").max(500),
});

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    if (body.endDate < body.startDate) fail("The end date must be on or after the start date");
    if (body.percent === 0) fail("The price change cannot be 0%");
    const rate = await prisma.seasonalRate.create({
      data: {
        hotelId: currentHotelId(),
        name: body.name,
        startDate: dateFromKey(body.startDate),
        endDate: dateFromKey(body.endDate),
        roomType: body.roomType || null,
        percent: body.percent,
      },
    });
    await logActivity(user, "Special price added", `${body.name}: ${body.percent}% ${body.startDate} to ${body.endDate}`);
    return NextResponse.json(rate, { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  return withAdmin(async (user) => {
    const id = new URL(request.url).searchParams.get("id");
    const rate = id ? await prisma.seasonalRate.findUnique({ where: { id } }) : null;
    if (!rate) fail("Not found", 404);
    await prisma.seasonalRate.delete({ where: { id: rate.id } });
    await logActivity(user, "Special price removed", rate.name);
    return NextResponse.json({ success: true });
  });
}
