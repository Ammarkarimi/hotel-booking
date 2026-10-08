"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Textarea } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { cn, formatDate, label } from "@/lib/utils";
import type { RoomDTO } from "@/lib/types";

const COLUMNS = [
  { key: "dirty", title: "Needs cleaning", tone: "border-red-200 bg-red-50/50", icon: TriangleAlert, iconColor: "text-red-600" },
  { key: "cleaning", title: "Being cleaned", tone: "border-amber-200 bg-amber-50/50", icon: Loader, iconColor: "text-amber-600" },
  { key: "clean", title: "Clean & ready", tone: "border-emerald-200 bg-emerald-50/50", icon: CheckCircle2, iconColor: "text-emerald-600" },
];

export default function HousekeepingPage() {
  const { toast, settings } = useApp();
  const [rooms, setRooms] = useState<RoomDTO[] | null>(null);
  const [assigning, setAssigning] = useState<RoomDTO | null>(null);
  const [cleaner, setCleaner] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<RoomDTO[]>("/api/rooms").then(setRooms).catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function update(room: RoomDTO, housekeeping: string, extra: Record<string, unknown> = {}) {
    setBusy(room.id);
    try {
      await api(`/api/rooms/${room.id}/housekeeping`, { body: { housekeeping, ...extra } });
      toast(`Room ${room.roomNumber}: ${label(housekeeping)}`);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!rooms) return <Loading />;

  // Rooms with a guest arriving today come first, occupied rooms last.
  const priority = (r: RoomDTO) => (r.nextBooking?.checkIn === settings.today ? 0 : r.currentGuest ? 2 : 1);

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        description="Rooms become “Needs cleaning” automatically when a guest checks out. Rooms with guests arriving today are shown first."
      />
      {rooms.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No rooms yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = rooms
              .filter((r) => r.housekeeping === col.key)
              .sort((a, b) => priority(a) - priority(b) || a.roomNumber.localeCompare(b.roomNumber));
            const Icon = col.icon;
            return (
              <div key={col.key} className={cn("rounded-2xl border-2 p-3", col.tone)}>
                <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-bold">
                  <Icon className={cn("h-5 w-5", col.iconColor)} /> {col.title} <span className="text-slate-400">({list.length})</span>
                </h2>
                <div className="space-y-3">
                  {list.length === 0 && <p className="px-1 py-4 text-center text-sm text-slate-500">None</p>}
                  {list.map((r) => {
                    const arrivingToday = r.nextBooking?.checkIn === settings.today;
                    return (
                      <Card key={r.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xl font-bold">Room {r.roomNumber}</p>
                            <p className="text-sm text-slate-500">
                              {label(r.type)}
                              {r.floor && ` · ${r.floor}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {arrivingToday && col.key !== "clean" && <Badge variant="danger">Guest arriving today</Badge>}
                            {r.currentGuest ? <Badge variant="info">Guest inside</Badge> : <Badge>Empty</Badge>}
                            {r.status === "maintenance" && <Badge variant="maintenance">Not usable</Badge>}
                          </div>
                        </div>
                        {r.houseKeeperName && (
                          <p className="mt-2 text-sm">
                            Cleaner: <b>{r.houseKeeperName}</b>
                          </p>
                        )}
                        {r.housekeepingNotes && <p className="mt-1 text-sm text-slate-600">Note: {r.housekeepingNotes}</p>}
                        {r.nextBooking && !arrivingToday && <p className="mt-1 text-xs text-slate-500">Next guest {formatDate(r.nextBooking.checkIn)}</p>}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {col.key !== "cleaning" && (
                            <Button
                              size="sm"
                              variant="warning"
                              loading={busy === r.id}
                              onClick={() => {
                                setAssigning(r);
                                setCleaner(r.houseKeeperName ?? "");
                                setNote(r.housekeepingNotes ?? "");
                              }}
                            >
                              Start cleaning
                            </Button>
                          )}
                          {col.key !== "clean" && (
                            <Button size="sm" variant="success" loading={busy === r.id} onClick={() => update(r, "clean")}>
                              <CheckCircle2 className="h-4 w-4" /> Mark clean
                            </Button>
                          )}
                          {col.key !== "dirty" && (
                            <Button size="sm" variant="outline" loading={busy === r.id} onClick={() => update(r, "dirty")}>
                              Needs cleaning
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title={`Start cleaning room ${assigning?.roomNumber ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={async () => {
                if (assigning) await update(assigning, "cleaning", { houseKeeperName: cleaner, housekeepingNotes: note });
                setAssigning(null);
              }}
            >
              Start cleaning
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Who is cleaning?" optional>
            <Input value={cleaner} onChange={(e) => setCleaner(e.target.value)} placeholder="Name of housekeeper" autoFocus />
          </Field>
          <Field label="Note" optional hint="e.g. change bedsheets, fix tap">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
