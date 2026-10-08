"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileCheck2, FileWarning, Search, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Loading, PageHeader } from "@/components/ui";
import { GuestFormDialog } from "@/components/guest-form";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import type { GuestDTO } from "@/lib/types";

type GuestRow = GuestDTO & {
  _count: { bookings: number };
  bookings: Array<{ checkInDate: string; room: { roomNumber: string } }>;
  documents: Array<{ id: string }>;
};

export default function GuestsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [guests, setGuests] = useState<GuestRow[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api<GuestRow[]>(`/api/guests${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`)
        .then(setGuests)
        .catch(() => setGuests([]));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Everyone who has stayed or booked. Search by name, phone, ID number or company."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-5 w-5" /> Add guest
          </Button>
        }
      />
      <div className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input className="pl-10" placeholder="Search guests" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {guests === null ? (
        <Loading />
      ) : guests.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={q ? "No guests found" : "No guests yet"} description="Guests are added automatically when you make a booking." action={<Button onClick={() => setAddOpen(true)}>Add guest</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {guests.map((g) => (
              <li key={g.id}>
                <Link href={`/guests/${g.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      {g.firstName} {g.lastName}
                      {g.vip && <Badge variant="purple">VIP</Badge>}
                      {g.blacklisted && <Badge variant="danger">Do not allow</Badge>}
                      {g.nationality.toLowerCase() !== "indian" && <Badge variant="info">{g.nationality}</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {g.phone}
                      {g.company && ` · ${g.company}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>
                      {g._count.bookings} booking{g._count.bookings === 1 ? "" : "s"}
                      {g.bookings[0] && ` · last ${formatDate(g.bookings[0].checkInDate)}`}
                    </span>
                    {g.documents.length > 0 ? (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <FileCheck2 className="h-4 w-4" /> ID saved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700">
                        <FileWarning className="h-4 w-4" /> No ID photo
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <GuestFormDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={(g) => router.push(`/guests/${g.id}`)} />
    </div>
  );
}
