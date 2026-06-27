import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import BillingClient from "@/components/billing-client";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppLayout user={session}>
      <BillingClient />
    </AppLayout>
  );
}
