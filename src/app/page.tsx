import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppLayout user={session}>
      <DashboardClient />
    </AppLayout>
  );
}
