import type { Metadata } from "next";
import { rawPrisma, runForHotel } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ hotel: string }> }): Promise<Metadata> {
  try {
    const { hotel: slug } = await params;
    const hotel = await rawPrisma.hotel.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!hotel) return { title: { absolute: "Book a room" } };
    const s = await runForHotel(hotel.id, getSettings);
    return {
      title: { absolute: `Book a room · ${s.hotelName}` },
      description: s.tagline || `Book your stay directly at ${s.hotelName}.`,
    };
  } catch {
    return { title: { absolute: "Book a room" } };
  }
}

export default function HotelBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
