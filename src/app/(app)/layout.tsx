import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma, runForHotel } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { monthLabel, monthOf, subscriptionSummary } from "@/lib/subscription";
import { PLATFORM_TIMEZONE } from "@/lib/platform";
import { AppLayout } from "@/components/layout";

export const dynamic = "force-dynamic";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // A valid cookie for an account that was switched off, or a paused hotel: clear it first,
  // or the sign-in page would send them straight back here.
  if (!session) redirect("/api/auth/expired");

  const { settings, hotel } = await runForHotel(session.hotelId, async () => ({
    settings: await getSettings(),
    hotel: await prisma.hotel.findUniqueOrThrow({
      where: { id: session.hotelId },
      include: { subscriptionPayments: { select: { month: true, amount: true, clearsMonth: true } } },
    }),
  }));

  // Owners see a reminder when an earlier month's software subscription is unpaid.
  let subscriptionNotice: string | null = null;
  if (session.role === "admin") {
    const summary = subscriptionSummary(hotel, hotel.subscriptionPayments, monthOf(todayKey(PLATFORM_TIMEZONE)));
    if (summary.overdueMonths.length > 0) {
      subscriptionNotice = `Your software subscription for ${summary.overdueMonths.map(monthLabel).join(", ")} is not paid yet. Please pay your software provider to keep using the software without interruption.`;
    }
  }

  return (
    <AppLayout
      user={session}
      settings={{
        hotelName: settings.hotelName,
        currency: settings.currency,
        timezone: settings.timezone,
        today: todayKey(settings.timezone),
        bookingSlug: hotel.slug,
        subscriptionNotice,
        checkInTime: settings.checkInTime,
        checkOutTime: settings.checkOutTime,
        phone: settings.phone,
        address: [settings.address, settings.city].filter(Boolean).join(", ") || null,
        pathik: settings.pathik,
        messages: { booking: settings.msgBooking, checkIn: settings.msgCheckIn, checkOut: settings.msgCheckOut },
      }}
    >
      {children}
    </AppLayout>
  );
}
