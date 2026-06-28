"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit, CheckCircle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Modal,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { formatCurrency, ROOM_TYPES, ROOM_STATUSES } from "@/lib/utils";

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  pricePerNight: number;
  amenities: string[];
  status: string;
  houseKeeperName?: string | null;
  currentGuest?: { firstName: string; lastName: string } | null;
}

export default function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [housekeepingModalOpen, setHousekeepingModalOpen] = useState(false);
  const [housekeepingRoom, setHousekeepingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState({
    roomNumber: "",
    type: "single",
    pricePerNight: "",
    amenities: "",
    status: "available",
    houseKeeperName: "",
  });
  const [housekeepingForm, setHousekeepingForm] = useState({ houseKeeperName: "" });

  async function loadRooms() {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setRooms(data);
    setLoading(false);
  }

  useEffect(() => {
    loadRooms();
  }, []);

  function openAddModal() {
    setEditingRoom(null);
    setForm({ roomNumber: "", type: "single", pricePerNight: "", amenities: "", status: "available", houseKeeperName: "" });
    setModalOpen(true);
  }

  function openEditModal(room: Room) {
    setEditingRoom(room);
    setForm({
      roomNumber: room.roomNumber,
      type: room.type,
      pricePerNight: String(room.pricePerNight),
      amenities: room.amenities.join(", "),
      status: room.status,
      houseKeeperName: room.houseKeeperName || "",
    });
    setModalOpen(true);
  }

  function openHousekeepingModal(room: Room) {
    setHousekeepingRoom(room);
    setHousekeepingForm({ houseKeeperName: room.houseKeeperName || "" });
    setHousekeepingModalOpen(true);
  }

  async function handleHousekeepingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!housekeepingRoom) return;

    const payload = {
      status: "housekeeping",
      houseKeeperName: housekeepingForm.houseKeeperName,
    };

    const res = await fetch(`/api/rooms/${housekeepingRoom.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Could not assign housekeeper");
      return;
    }

    setHousekeepingModalOpen(false);
    setHousekeepingRoom(null);
    loadRooms();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amenities = form.amenities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const payload = {
      roomNumber: form.roomNumber,
      type: form.type,
      pricePerNight: parseFloat(form.pricePerNight),
      amenities,
      status: form.status,
      houseKeeperName: form.houseKeeperName || null,
    };

    if (editingRoom) {
      await fetch(`/api/rooms/${editingRoom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setModalOpen(false);
    loadRooms();
  }

  async function handleHousekeepingDone(id: string) {
    const res = await fetch(`/api/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "available", houseKeeperName: null }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Could not complete housekeeping");
      return;
    }
    loadRooms();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this room?")) return;
    const res = await fetch(`/api/rooms?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    loadRooms();
  }

  if (loading) return <div className="text-slate-500">Loading rooms...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Management</h1>
          <p className="text-slate-500">Add, edit, and manage hotel rooms</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Card key={room.id} className="h-full min-h-[380px]">
            <CardContent className="flex h-full flex-col justify-between">
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Room {room.roomNumber}</h3>
                    <p className="text-sm capitalize text-slate-500">{room.type}</p>
                  </div>
                  <Badge variant={room.status}>{room.status}</Badge>
                </div>

                <p className="mb-3 text-lg font-semibold text-primary-600">
                  {formatCurrency(room.pricePerNight)}
                  <span className="text-sm font-normal text-slate-500">/night</span>
                </p>

              {room.amenities.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {room.amenities.map((a) => (
                    <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {room.houseKeeperName && (
                <p className="mb-3 text-sm text-slate-700">
                  Housekeeper: <strong>{room.houseKeeperName}</strong>
                </p>
              )}
              {room.currentGuest && (
                <p className="mb-3 text-sm text-purple-600">
                  Guest: {room.currentGuest.firstName} {room.currentGuest.lastName}
                </p>
              )}

              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => openEditModal(room)}>
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <Button type="button" variant="ghost" className="flex-1" onClick={() => openHousekeepingModal(room)}>
                  Housekeeping
                </Button>
                {room.status === "housekeeping" && room.houseKeeperName ? (
                  <Button
                    type="button"
                    variant="success"
                    className="flex-1"
                    onClick={() => handleHousekeepingDone(room.id)}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Done
                  </Button>
                ) : null}
                <Button type="button" variant="danger" className="flex-1" onClick={() => handleDelete(room.id)}>
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRoom ? "Edit Room" : "Add Room"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Room Number</Label>
            <Input
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              placeholder="101"
              required
            />
          </div>
          <div>
            <Label>Room Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Price per Night (₹)</Label>
            <Input
              type="number"
              value={form.pricePerNight}
              onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
              required
              min="0"
            />
          </div>
          <div>
            <Label>Amenities (comma-separated)</Label>
            <Input
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              placeholder="WiFi, AC, TV"
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {ROOM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Housekeeper Name</Label>
            <Input
              value={form.houseKeeperName}
              onChange={(e) => setForm({ ...form, houseKeeperName: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingRoom ? "Update" : "Add Room"}
            </Button>
          </div>
        </form>
      </Modal>
        <Modal
          open={housekeepingModalOpen}
          onClose={() => setHousekeepingModalOpen(false)}
          title={housekeepingRoom ? `Assign Housekeeper to Room ${housekeepingRoom.roomNumber}` : "Assign Housekeeper"}
        >
          <form onSubmit={handleHousekeepingSubmit} className="space-y-4">
            <div>
              <Label>Housekeeper Name</Label>
              <Input
                value={housekeepingForm.houseKeeperName}
                onChange={(e) => setHousekeepingForm({ houseKeeperName: e.target.value })}
                placeholder="Enter name"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setHousekeepingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
}
