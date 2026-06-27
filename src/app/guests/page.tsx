import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import GuestsClient from "@/components/guests-client";

export default async function GuestsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppLayout user={session}>
      <GuestsClient />
    </AppLayout>
  );
}
