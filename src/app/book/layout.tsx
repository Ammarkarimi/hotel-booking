import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getSettings();
    return {
      title: { absolute: `Book a room · ${s.hotelName}` },
      description: s.tagline || `Book your stay directly at ${s.hotelName}.`,
    };
  } catch {
    return { title: { absolute: "Book a room" } };
  }
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
