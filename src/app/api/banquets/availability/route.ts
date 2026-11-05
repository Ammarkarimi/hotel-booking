import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { isDateKey, toDateKey } from "@/lib/dates";
import { hallClashes } from "@/lib/banquets";

/** For the function form: is each hall free on this date and time? `exceptId` skips the function being changed. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const p = new URL(request.url).searchParams;
    const date = p.get("date");
    const start = p.get("start") || "";
    const end = p.get("end") || "";
    if (!isDateKey(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) fail("Please choose the date and time");
    const exceptId = p.get("exceptId") || undefined;
    const halls = await prisma.banquetHall.findMany({ orderBy: { name: "asc" } });
    const result = await Promise.all(
      halls.map(async (h) => ({
        hallId: h.id,
        clashes: (await hallClashes(prisma, { hallId: h.id, date, start, end, exceptId })).map((c) => ({
          id: c.id,
          number: c.number,
          customerName: c.customerName,
          date: toDateKey(c.eventDate),
          startTime: c.startTime,
          endTime: c.endTime,
          status: c.status,
        })),
      }))
    );
    return NextResponse.json(result);
  });
}
