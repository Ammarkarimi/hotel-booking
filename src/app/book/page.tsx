import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rawPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Book a room" } };

/**
 * Each hotel's booking page lives at /book/<hotel>. Old links to plain /book still
 * work while only one hotel uses the software.
 */
export default async function BookIndexPage() {
  const hotels = await rawPrisma.hotel.findMany({ where: { status: "active" }, select: { slug: true }, take: 2 });
  if (hotels.length === 1) redirect(`/book/${hotels[0].slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Book a room</h1>
      <p className="mt-2 text-slate-600">Please use the booking link your hotel shared with you.</p>
    </main>
  );
}
