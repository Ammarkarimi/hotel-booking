import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import RoomsClient from "@/components/rooms-client";

export default async function RoomsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppLayout user={session}>
      <RoomsClient />
    </AppLayout>
  );
}
