"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loading, PageHeader } from "@/components/ui";
import { BanquetForm } from "@/components/banquet-form";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { BanquetDTO } from "@/lib/banquet-types";

function NewFunction() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useApp();
  const [saving, setSaving] = useState(false);
  // From the hall calendar: the hall and date tapped.
  const initial = { ...(params.get("hall") && { hallId: params.get("hall")! }), ...(params.get("date") && { eventDate: params.get("date")! }) };

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const b = await api<BanquetDTO>("/api/banquets", { body });
      toast(b.status === "enquiry" ? `Enquiry #${b.number} saved` : `Function #${b.number} booked`);
      router.push(`/banquets/${b.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="New function" description="A wedding, party or meeting in one of your halls: an enquiry, a hold or a confirmed booking." />
      <BanquetForm initial={initial} onSubmit={save} submitting={saving} />
    </div>
  );
}

export default function NewFunctionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewFunction />
    </Suspense>
  );
}
