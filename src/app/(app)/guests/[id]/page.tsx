"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Loading, Row, StatCard, StatusBadge, Tip } from "@/components/ui";
import { GuestFormDialog } from "@/components/guest-form";
import { PathikButton } from "@/components/pathik";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { formatCurrency, formatDate, label } from "@/lib/utils";
import { fullAddress } from "@/lib/guest-form";
import type { BookingDTO, GuestDTO } from "@/lib/types";

type GuestDetail = GuestDTO & {
  bookings: BookingDTO[];
  summary: { stays: number; nights: number; spent: number; owed: number };
};

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, toast, isAdmin } = useApp();
  const [g, setG] = useState<GuestDetail | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    api<GuestDetail>(`/api/guests/${id}`).then(setG).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => load(), [load]);

  if (error) return <EmptyState title="Guest not found" description={error} />;
  if (!g) return <Loading />;

  const name = `${g.firstName} ${g.lastName}`.trim();

  async function removeGuest() {
    const ok = await confirm({ title: `Delete ${name}?`, message: "The guest record will be removed permanently.", confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/guests/${id}`, { method: "DELETE" });
      toast("Guest deleted");
      router.push("/guests");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/guests" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All guests
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {name} {g.vip && <Badge variant="purple">VIP</Badge>} {g.blacklisted && <Badge variant="danger">Do not allow</Badge>}
            </h1>
            <p className="mt-1 text-slate-500">Guest since {formatDate(g.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/bookings/new?guestId=${g.id}`}>
              <Button>
                <CalendarPlus className="h-5 w-5" /> New booking for {g.firstName}
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-5 w-5" /> Edit
            </Button>
            <PathikButton guestId={g.id} size="md" />
          </div>
        </div>
      </div>

      {g.blacklisted && g.notes && <Tip tone="danger">{g.notes}</Tip>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Stays" value={g.summary.stays} />
        <StatCard title="Nights" value={g.summary.nights} />
        <StatCard title="Total paid" value={formatCurrency(g.summary.spent)} />
        <StatCard title="Owes" value={formatCurrency(g.summary.owed)} tone={g.summary.owed > 0 ? "red" : "green"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <CardContent className="text-[15px]">
            <Row label="Phone">
              <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                <Phone className="h-4 w-4" /> {g.phone}
              </a>
            </Row>
            {g.email && <Row label="Email">{g.email}</Row>}
            <Row label="Nationality">{g.nationality}</Row>
            <Row label="ID">{g.idType ? label(g.idType) : "—"}</Row>
            {g.dateOfBirth && <Row label="Date of birth">{formatDate(g.dateOfBirth.slice(0, 10))}</Row>}
            {(g.address || g.city) && (
              <Row label="Address">
                <span className="text-right">{fullAddress(g)}</span>
              </Row>
            )}
            {g.company && <Row label="Company">{g.company}</Row>}
            {g.gstin && <Row label="GSTIN">{g.gstin}</Row>}
            {g.notes && !g.blacklisted && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{g.notes}</p>}
            <a href={whatsappLink(g.phone, `Hello ${g.firstName}, `)} target="_blank" rel="noopener noreferrer" className="mt-3 block">
              <Button variant="success" size="sm" className="w-full">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
            {isAdmin && g.bookings.length === 0 && (
              <Button variant="ghost" size="sm" className="mt-2 w-full text-red-600" onClick={removeGuest}>
                <Trash2 className="h-4 w-4" /> Delete guest
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={`Bookings (${g.bookings.length})`} />
          {g.bookings.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {g.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="block font-semibold">
                        #{b.number} · Room {b.room.roomNumber}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                      </span>
                    </span>
                    <span className="text-right">
                      <StatusBadge status={b.status} />
                      {b.folio.balance > 0.5 && b.status !== "cancelled" && b.status !== "no_show" && b.status !== "reserved" && (
                        <span className="block text-xs font-semibold text-red-600">owes {formatCurrency(b.folio.balance)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <GuestFormDialog open={editOpen} onClose={() => setEditOpen(false)} guest={g} onSaved={() => load()} />
    </div>
  );
}
