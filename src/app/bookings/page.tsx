import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import BookingsClient from "@/components/bookings-client";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppLayout user={session}>
      <BookingsClient />
    </AppLayout>
  );
}
