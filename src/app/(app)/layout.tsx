import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { AppLayout } from "@/components/layout";

export const dynamic = "force-dynamic";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const settings = await getSettings();

  return (
    <AppLayout
      user={session}
      settings={{
        hotelName: settings.hotelName,
        currency: settings.currency,
        timezone: settings.timezone,
        today: todayKey(settings.timezone),
      }}
    >
      {children}
    </AppLayout>
  );
}
