"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, Loading, PageHeader, Button } from "@/components/ui";
import { BanquetForm, valuesFrom } from "@/components/banquet-form";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { BanquetDTO } from "@/lib/banquet-types";

export default function EditFunctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, isAdmin } = useApp();
  const [banquet, setBanquet] = useState<BanquetDTO | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<BanquetDTO>(`/api/banquets/${id}`)
      .then(setBanquet)
      .catch((e) => setError(e.message));
  }, [id]);

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await api(`/api/banquets/${id}`, { method: "PATCH", body });
      toast("Function changed");
      router.push(`/banquets/${id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  if (error) return <EmptyState title={error} />;
  if (!banquet) return <Loading />;
  const locked = banquet.status === "cancelled" || (banquet.status === "completed" && !isAdmin);
  if (locked) {
    return (
      <EmptyState
        title={banquet.status === "cancelled" ? "This function is cancelled" : "Only the owner can change a function after its final bill"}
        action={
          <Link href={`/banquets/${id}`}>
            <Button>Back to the function</Button>
          </Link>
        }
      />
    );
  }
  return (
    <div>
      <PageHeader
        title={`Change function #${banquet.number}`}
        description={banquet.status === "completed" ? `The final bill ${banquet.invoiceNumber} keeps its number and gets the new amounts.` : "Extra items and payments are changed on the function's page."}
      />
      <BanquetForm initial={valuesFrom(banquet)} existing={banquet} onSubmit={save} submitting={saving} />
    </div>
  );
}
