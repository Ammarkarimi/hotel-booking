import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withModule, withModuleAdmin } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { siteName } from "@/lib/channels";
import { checkImportUrl, syncCalendars } from "@/lib/channel-calendars";
import { label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function find(id: string) {
  const calendar = await prisma.channelCalendar.findUnique({ where: { id }, include: { room: { select: { roomNumber: true } } } });
  if (!calendar) fail("This calendar link was not found. It may have been removed.", 404);
  return calendar;
}

function describe(c: { source: string; roomType: string | null; room: { roomNumber: string } | null }) {
  return `${siteName(c.source)}, ${c.room ? `Room ${c.room.roomNumber}` : `${label(c.roomType ?? "")} rooms`}`;
}

const schema = z.object({
  name: z.string().trim().max(100).nullish(),
  importUrl: z.string().trim().max(2000).nullish(),
  active: z.boolean().optional(),
});

/** Changes the name or the site's link, or pauses the link (nothing is sent or read while paused). */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withModuleAdmin("channel_manager", async (user) => {
    const { id } = await params;
    const data = schema.parse(await request.json());
    const calendar = await find(id);

    let importUrl = calendar.importUrl;
    if (data.importUrl !== undefined) {
      if (!data.importUrl) importUrl = null;
      else {
        const checked = checkImportUrl(data.importUrl);
        if (!checked.ok) fail(checked.message);
        importUrl = checked.url;
        if (await prisma.channelCalendar.count({ where: { importUrl, id: { not: id } } })) fail("This calendar link is already added. Each listing on a booking site has its own link.");
      }
    }
    const newLink = importUrl !== calendar.importUrl;
    await prisma.channelCalendar.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name || null }),
        ...(data.active !== undefined && { active: data.active }),
        // A new link has not been read yet.
        ...(newLink && { importUrl, lastSyncAt: null, lastError: null, lastEvents: 0 }),
      },
    });
    if (data.active !== undefined && data.active !== calendar.active) await logActivity(user, data.active ? "Calendar link turned on again" : "Calendar link paused", describe(calendar));
    else if (newLink) await logActivity(user, "Calendar link changed", describe(calendar));
    return NextResponse.json({ ok: true });
  });
}

/** Removes the link. The bookings it brought stay in the books. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withModuleAdmin("channel_manager", async (user) => {
    const { id } = await params;
    const calendar = await find(id);
    await prisma.channelCalendar.delete({ where: { id } });
    await logActivity(user, "Calendar link removed", describe(calendar));
    return NextResponse.json({ ok: true });
  });
}

/** "Read now": reads this one site's calendar straight away. */
export async function POST(_request: NextRequest, { params }: Params) {
  return withModule("channel_manager", async () => {
    const { id } = await params;
    const calendar = await find(id);
    if (!calendar.importUrl) fail("This link only sends your booked nights to the site. Add the site's own calendar link to read its bookings.");
    if (!calendar.active) fail("This link is paused. Press Resume first.");
    const result = await syncCalendars(await getBillingContext(), { force: true, calendarId: id });
    const after = await prisma.channelCalendar.findUnique({ where: { id }, select: { lastError: true, lastEvents: true } });
    return NextResponse.json({ ...result, error: after?.lastError ?? null, events: after?.lastEvents ?? 0 });
  });
}
