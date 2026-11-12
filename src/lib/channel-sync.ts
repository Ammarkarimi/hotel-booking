// Keeps the hotel in step with its booking sites: calendar links first, then Channex.
// Run when the Dashboard, Calendar or Booking sites screen opens, when a site reads our calendar
// link, and by the timer (/api/public/cron/channels).
import { rawPrisma, runForHotel } from "./db";
import { getBillingContext, getHotelModules, type BillingContext } from "./settings";
import { syncCalendars, type CalendarSyncResult } from "./channel-calendars";
import { syncChannex, type ChannexSyncResult } from "./channex-sync";
import { openChannelIssues } from "./channel-bookings";

export interface ChannelSyncResult {
  calendars: CalendarSyncResult | null;
  channex: ChannexSyncResult | null;
  /** Questions from booking sites waiting for a person. */
  openIssues: number;
}

export async function syncChannels(ctx: BillingContext, opts: { force?: boolean } = {}): Promise<ChannelSyncResult> {
  const calendars = await syncCalendars(ctx, opts).catch((error) => {
    console.error("Calendar links could not be read", error);
    return null;
  });
  const channex = await syncChannex(ctx, opts).catch((error) => {
    console.error("Channex could not be reached", error);
    return null;
  });
  return { calendars, channex, openIssues: await openChannelIssues() };
}

/** The same for one hotel from outside a signed-in request. Hotels without the channel manager are skipped. */
export async function syncHotelChannels(hotelId: string, opts: { force?: boolean } = {}): Promise<ChannelSyncResult | null> {
  return runForHotel(hotelId, async () => {
    if (!(await getHotelModules()).includes("channel_manager")) return null;
    return syncChannels(await getBillingContext(), opts);
  });
}

/** Every active hotel that has a calendar link or is joined to Channex. For the timer. */
export async function syncAllHotels(): Promise<{ hotels: number; failed: number }> {
  const hotels = await rawPrisma.hotel.findMany({
    where: { status: "active", OR: [{ channelCalendars: { some: { active: true } } }, { channexLink: { isNot: null } }] },
    select: { id: true },
  });
  let failed = 0;
  for (const h of hotels) {
    try {
      await syncHotelChannels(h.id);
    } catch (error) {
      failed += 1;
      console.error(`Booking sites of hotel ${h.id} could not be brought up to date`, error);
    }
  }
  return { hotels: hotels.length, failed };
}
