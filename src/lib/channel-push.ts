// Sends the hotel's free rooms and prices to its booking sites after something changed.
// Called by src/lib/db.ts after every write to a booking, a room or a price.
import { after } from "next/server";
import { rawPrisma, runForHotel } from "./db";

/** How long a planned update waits, so the many writes of one request (or of a few at once) go out together. */
const GATHER_MS = 300;

/** Per hotel: the update that is planned and has not started yet. Later calls join it. */
const planned = new Map<string, Promise<void>>();

async function sendNow(hotelId: string) {
  const link = await rawPrisma.channexLink.findUnique({ where: { hotelId }, select: { id: true } });
  if (!link) return;
  await runForHotel(hotelId, async () => {
    const [{ getBillingContext, getHotelModules }, { pushChannex }] = await Promise.all([import("./settings"), import("./channex-sync")]);
    if (!(await getHotelModules()).includes("channel_manager")) return;
    // Never throws: a failure is saved on the link and shown on the Booking sites screen.
    await pushChannex(await getBillingContext());
  });
}

/**
 * The update for this hotel that has not started yet, or a new one. It starts only after this
 * call, so it reads what the caller wrote (the caller's request has answered by then).
 */
function joinPlanned(hotelId: string): Promise<void> {
  const waiting = planned.get(hotelId);
  if (waiting) return waiting;
  const run = new Promise<void>((resolve) => {
    setTimeout(() => {
      // Started: a write after this moment plans a new update.
      if (planned.get(hotelId) === run) planned.delete(hotelId);
      sendNow(hotelId)
        .catch((error) => console.error(`Free rooms and prices of hotel ${hotelId} could not be sent`, error))
        .finally(resolve);
    }, GATHER_MS);
  });
  planned.set(hotelId, run);
  return run;
}

/** Plans one update for this hotel, sent after the current request has answered. Never throws. */
export function scheduleChannelPush(hotelId: string) {
  if (!process.env.CHANNEX_API_KEY || !hotelId) return;
  try {
    // Joined when the request has answered, so its writes are saved before anything is read.
    after(() => joinPlanned(hotelId));
  } catch {
    // Not inside a request (a script or a test): send a moment later instead.
    try {
      void joinPlanned(hotelId);
    } catch (error) {
      console.error("Could not plan the update to booking sites", error);
    }
  }
}
