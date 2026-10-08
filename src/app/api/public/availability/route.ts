import { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { findAvailableRooms, parseStayDate, validateStay } from "@/lib/bookings";
import { assertWebsiteOpen, noStore, validatePublicStay } from "@/lib/public";
import { parseAmenities } from "@/lib/utils";

/** Room types guests can book on the website, with the price for their dates. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ctx = await getBillingContext();
    assertWebsiteOpen(ctx.settings);
    const checkIn = parseStayDate(searchParams.get("checkIn"), "arrival");
    const checkOut = parseStayDate(searchParams.get("checkOut"), "leaving");
    validateStay(checkIn, checkOut);
    validatePublicStay(ctx, checkIn, checkOut);
    const guests = Math.max(1, Number(searchParams.get("guests")) || 1);

    const rooms = await findAvailableRooms(ctx, { checkIn, checkOut, guests });
    const byType = new Map<string, (typeof rooms)[number][]>();
    for (const r of rooms) byType.set(r.room.type, [...(byType.get(r.room.type) ?? []), r]);

    const options = [...byType.entries()]
      .map(([type, list]) => {
        const cheapest = list.reduce((a, b) => (b.quote.grandTotal < a.quote.grandTotal ? b : a));
        return {
          type,
          available: list.length,
          capacity: Math.max(...list.map((l) => l.room.capacity)),
          description: list.find((l) => l.room.description)?.room.description ?? null,
          amenities: [...new Set(list.flatMap((l) => parseAmenities(l.room.amenities)))],
          nights: cheapest.quote.nightCount,
          roomTotal: cheapest.quote.roomTotal,
          tax: cheapest.quote.taxTotal,
          total: cheapest.quote.grandTotal,
        };
      })
      .sort((a, b) => a.total - b.total);

    return noStore({ checkIn, checkOut, guests, options });
  } catch (error) {
    return handleError(error);
  }
}
