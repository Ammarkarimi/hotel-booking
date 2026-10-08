"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BedDouble, Pencil, Plus, Trash2, Users, Wrench } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { AMENITY_SUGGESTIONS, ROOM_TYPES, cn, formatCurrency, formatDate, label } from "@/lib/utils";
import type { RoomDTO } from "@/lib/types";

const EMPTY = { roomNumber: "", type: "double", floor: "", capacity: "2", pricePerNight: "", description: "", amenities: [] as string[] };

function RoomDialog({ open, onClose, room, onSaved }: { open: boolean; onClose: () => void; room: RoomDTO | null; onSaved: () => void }) {
  const { toast } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustom("");
    setForm(
      room
        ? {
            roomNumber: room.roomNumber,
            type: room.type,
            floor: room.floor ?? "",
            capacity: String(room.capacity),
            pricePerNight: String(room.pricePerNight),
            description: room.description ?? "",
            amenities: room.amenities,
          }
        : EMPTY
    );
  }, [open, room]);

  function toggleAmenity(a: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(room ? `/api/rooms/${room.id}` : "/api/rooms", {
        method: room ? "PUT" : "POST",
        body: { ...form, capacity: Number(form.capacity), pricePerNight: Number(form.pricePerNight) },
      });
      toast(room ? `Room ${form.roomNumber} saved` : `Room ${form.roomNumber} added`);
      onSaved();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const allAmenities = [...new Set([...AMENITY_SUGGESTIONS, ...form.amenities])];

  return (
    <Modal open={open} onClose={onClose} title={room ? `Edit room ${room.roomNumber}` : "Add a room"} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Room number">
            <Input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="101" required autoFocus />
          </Field>
          <Field label="Room type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Floor" optional>
            <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="First" />
          </Field>
          <Field label="Normal price per night">
            <Input type="number" min={0} inputMode="decimal" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} required />
          </Field>
          <Field label="Max guests">
            <Input type="number" min={1} max={50} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
          </Field>
        </div>
        <Field label="Facilities" hint="Tap to select. Shown to guests on the booking website.">
          <div className="flex flex-wrap gap-2">
            {allAmenities.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => toggleAmenity(a)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  form.amenities.includes(a) ? "border-primary-500 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {form.amenities.includes(a) ? "✓ " : ""}
                {a}
              </button>
            ))}
            <span className="flex gap-1">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other..." className="min-h-9 w-32 py-1 text-sm" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (custom.trim()) toggleAmenity(custom.trim());
                  setCustom("");
                }}
              >
                Add
              </Button>
            </span>
          </div>
        </Field>
        <Field label="Description" optional hint="A short line for guests, e.g. 'Spacious room with balcony and city view'.">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {room ? "Save room" : "Add room"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RoomsPage() {
  const { isAdmin, toast, confirm } = useApp();
  const [rooms, setRooms] = useState<RoomDTO[] | null>(null);
  const [editing, setEditing] = useState<RoomDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    api<RoomDTO[]>("/api/rooms").then(setRooms).catch(() => setRooms([]));
  }, []);
  useEffect(() => load(), [load]);

  async function toggleMaintenance(r: RoomDTO) {
    const toMaintenance = r.status !== "maintenance";
    const ok = await confirm({
      title: toMaintenance ? `Mark room ${r.roomNumber} as not usable?` : `Room ${r.roomNumber} is ready again?`,
      message: toMaintenance
        ? "Use this during repairs. The room cannot be booked until you make it usable again."
        : "The room will be available for booking again.",
      confirmText: toMaintenance ? "Yes, not usable" : "Yes, ready",
    });
    if (!ok) return;
    try {
      await api(`/api/rooms/${r.id}`, { method: "PUT", body: { status: toMaintenance ? "maintenance" : "available" } });
      toast(toMaintenance ? `Room ${r.roomNumber} marked not usable` : `Room ${r.roomNumber} is usable again`);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(r: RoomDTO) {
    const ok = await confirm({ title: `Delete room ${r.roomNumber}?`, message: "This cannot be undone.", confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/rooms/${r.id}`, { method: "DELETE" });
      toast(`Room ${r.roomNumber} deleted`);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Rooms"
        description={isAdmin ? "Your rooms, their type, price and facilities." : "Your rooms, their type, price and who is inside."}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-5 w-5" /> Add room
            </Button>
          )
        }
      />
      {isAdmin && (
        <div className="mb-4">
          <Tip>
            Prices here are the normal nightly price. Weekend and festival price changes are set in{" "}
            <Link href="/settings?tab=prices" className="font-semibold underline">
              Settings → Prices & tax
            </Link>
            .
          </Tip>
        </div>
      )}
      {rooms === null ? (
        <Loading />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="h-6 w-6" />}
          title="No rooms added yet"
          description="Add each room in your hotel with its number, type and price."
          action={isAdmin && <Button onClick={() => setDialogOpen(true)}>Add your first room</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <Card key={r.id} className={cn(r.status === "maintenance" && "opacity-80")}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-2xl font-bold">Room {r.roomNumber}</p>
                    <p className="text-sm text-slate-500">
                      {label(r.type)}
                      {r.floor && ` · ${r.floor} floor`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    <StatusBadge status={r.housekeeping} />
                  </div>
                </div>
                <p className="text-lg font-bold text-primary-700">
                  {formatCurrency(r.pricePerNight)} <span className="text-sm font-normal text-slate-500">per night</span>
                </p>
                <p className="flex items-center gap-1 text-sm text-slate-600">
                  <Users className="h-4 w-4" /> Up to {r.capacity} guest{r.capacity > 1 ? "s" : ""}
                </p>
                {r.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.amenities.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </div>
                )}
                {r.currentGuest && (
                  <Link href={`/bookings/${r.currentGuest.bookingId}`} className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 hover:underline">
                    Now: <b>{r.currentGuest.name}</b> until {formatDate(r.currentGuest.checkOut)}
                  </Link>
                )}
                {r.nextBooking && (
                  <Link href={`/bookings/${r.nextBooking.bookingId}`} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:underline">
                    Next: <b>{r.nextBooking.name}</b> from {formatDate(r.nextBooking.checkIn)}
                  </Link>
                )}
                {r.status === "maintenance" && r.housekeepingNotes && <p className="text-sm text-orange-700">{r.housekeepingNotes}</p>}
                {isAdmin && (
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(r);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleMaintenance(r)}>
                      <Wrench className="h-4 w-4" /> {r.status === "maintenance" ? "Make usable" : "Not usable"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <RoomDialog open={dialogOpen} onClose={() => setDialogOpen(false)} room={editing} onSaved={load} />
    </div>
  );
}
