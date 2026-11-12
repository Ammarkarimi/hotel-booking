import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withModule, withModuleAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { CHANNEL_SITES, siteName } from "@/lib/channels";
import { checkImportUrl, listCalendarLinks } from "@/lib/channel-calendars";
import { label } from "@/lib/utils";

/** The hotel's calendar links with booking sites, and its rooms for the "add" form. */
export async function GET() {
  return withModule("channel_manager", async () => NextResponse.json(await listCalendarLinks(await getBillingContext())));
}

const schema = z.object({
  source: z.enum(CHANNEL_SITES),
  name: z.string().trim().max(100).nullish(),
  roomId: z.string().min(1).nullish(),
  roomType: z.string().min(1).nullish(),
  importUrl: z.string().trim().max(2000).nullish(),
});

/** Adds a calendar link for one room, or for all rooms of one type. */
export async function POST(request: NextRequest) {
  return withModuleAdmin("channel_manager", async (user) => {
    const data = schema.parse(await request.json());
    if (!!data.roomId === !!data.roomType) fail("Please choose one room, or one room type.");
    const room = data.roomId ? await prisma.room.findUnique({ where: { id: data.roomId } }) : null;
    if (data.roomId && !room) fail("Room not found", 404);
    if (data.roomType && !(await prisma.room.count({ where: { type: data.roomType } }))) fail("You have no rooms of this type.");

    let importUrl: string | null = null;
    if (data.importUrl) {
      const checked = checkImportUrl(data.importUrl);
      if (!checked.ok) fail(checked.message);
      importUrl = checked.url;
      if (await prisma.channelCalendar.count({ where: { importUrl } })) fail("This calendar link is already added. Each listing on a booking site has its own link.");
    }

    const calendar = await prisma.channelCalendar.create({
      data: {
        hotelId: user.hotelId, // the hotel's own database client sets this too
        source: data.source,
        name: data.name || null,
        roomId: room?.id ?? null,
        roomType: room ? null : data.roomType!,
        exportToken: randomBytes(24).toString("hex"),
        importUrl,
      },
    });
    const where = room ? `Room ${room.roomNumber}` : `${label(data.roomType!)} rooms`;
    await logActivity(user, "Calendar link added", `${siteName(data.source)}, ${where}`);
    const list = await listCalendarLinks(await getBillingContext());
    return NextResponse.json({ calendar: list.calendars.find((c) => c.id === calendar.id) }, { status: 201 });
  });
}
