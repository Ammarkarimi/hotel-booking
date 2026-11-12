import { after, NextRequest, NextResponse } from "next/server";
import { calendarFeedByToken } from "@/lib/channel-calendars";
import { syncHotelChannels } from "@/lib/channel-sync";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The calendar a booking site reads from us (Airbnb, Booking.com, Agoda…): the nights that are
 * already sold in one room or one room type, with no guest details. The secret in the address is
 * the only key, so anyone who has the link can read it.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!rateLimit(`ical:${token.slice(0, 64)}`, 240, 3600_000)) return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "600" } });
  let feed: Awaited<ReturnType<typeof calendarFeedByToken>>;
  try {
    feed = await calendarFeedByToken(token);
  } catch (error) {
    console.error("The calendar for a booking site could not be made", error);
    return new NextResponse("Please try again later", { status: 503, headers: { "Retry-After": "600" } });
  }
  if (!feed) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  // Sites read this link every few hours: each read is also our reminder to read their calendars.
  if (feed.stale) {
    const { hotelId } = feed;
    try {
      after(async () => {
        await syncHotelChannels(hotelId).catch((error) => console.error(`Booking sites of hotel ${hotelId} could not be brought up to date`, error));
      });
    } catch (error) {
      console.error("Could not plan the reading of booking sites", error);
    }
  }
  return new NextResponse(feed.body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="calendar.ics"', "Cache-Control": "no-store" },
  });
}
