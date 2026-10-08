import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getBillingContext } from "@/lib/settings";
import { findAvailableRooms, parseStayDate, validateStay } from "@/lib/bookings";
import { parseAmenities } from "@/lib/utils";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const checkIn = parseStayDate(searchParams.get("checkIn"), "arrival");
    const checkOut = parseStayDate(searchParams.get("checkOut"), "leaving");
    validateStay(checkIn, checkOut);
    const ctx = await getBillingContext();
    const rooms = await findAvailableRooms(ctx, {
      checkIn,
      checkOut,
      excludeBookingId: searchParams.get("excludeBookingId") || undefined,
    });
    return NextResponse.json(
      rooms.map(({ room, quote }) => ({
        ...room,
        amenities: parseAmenities(room.amenities),
        quote,
      }))
    );
  });
}
