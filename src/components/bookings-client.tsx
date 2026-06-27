"use client";

import { useEffect, useState } from "react";
import { Plus, LogIn, LogOut, XCircle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Modal,
  Input,
  Label,
  Select,
  Badge,
} from "@/components/ui";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
}

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  pricePerNight: number;
  status: string;
}

interface Booking {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  adults: number;
  notes: string | null;
  guest: Guest;
  room: Room;
  payments: Array<{ amount: number }>;
  bill: { totalAmount: number } | null;
}

export default function BookingsClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    guestId: "",
    roomId: "",
    checkInDate: "",
    checkOutDate: "",
    adults: "1",
    notes: "",
  });

  async function loadData() {
    const [bookingsRes, guestsRes, roomsRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch("/api/guests"),
      fetch("/api/rooms"),
    ]);
    setBookings(await bookingsRes.json());
    setGuests(await guestsRes.json());
    setRooms(await roomsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        adults: parseInt(form.adults),
      }),
    });
    setModalOpen(false);
    setForm({ guestId: "", roomId: "", checkInDate: "", checkOutDate: "", adults: "1", notes: "" });
    loadData();
  }

  async function handleAction(bookingId: string, action: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    loadData();
  }

  const availableRooms = rooms.filter((r) => r.status === "available");
  const filteredBookings =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      reserved: "warning",
      checked_in: "occupied",
      checked_out: "success",
      cancelled: "danger",
    };
    return map[status] || "default";
  }

  if (loading) return <div className="text-slate-500">Loading bookings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500">Check-in, check-out, and reservation management</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      <div className="flex gap-2">
        {["all", "reserved", "checked_in", "checked_out", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? "bg-primary-100 text-primary-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredBookings.map((booking) => {
          const paid = booking.payments.reduce((s, p) => s + p.amount, 0);
          return (
            <Card key={booking.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {booking.guest.firstName} {booking.guest.lastName}
                      </h3>
                      <Badge variant={getStatusBadge(booking.status)}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Room {booking.room.roomNumber} ({booking.room.type}) ·{" "}
                      {formatCurrency(booking.room.pricePerNight)}/night
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                    </p>
                    {booking.actualCheckIn && (
                      <p className="text-xs text-slate-400">
                        Checked in: {formatDateTime(booking.actualCheckIn)}
                      </p>
                    )}
                    {booking.actualCheckOut && (
                      <p className="text-xs text-slate-400">
                        Checked out: {formatDateTime(booking.actualCheckOut)}
                      </p>
                    )}
                    {paid > 0 && (
                      <p className="mt-1 text-sm text-green-600">
                        Paid: {formatCurrency(paid)}
                        {booking.bill && ` / ${formatCurrency(booking.bill.totalAmount)}`}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {booking.status === "reserved" && (
                      <>
                        <Button onClick={() => handleAction(booking.id, "check_in")}>
                          <LogIn className="h-4 w-4" />
                          Check In
                        </Button>
                        <Button variant="danger" onClick={() => handleAction(booking.id, "cancel")}>
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {booking.status === "checked_in" && (
                      <Button onClick={() => handleAction(booking.id, "check_out")}>
                        <LogOut className="h-4 w-4" />
                        Check Out
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredBookings.length === 0 && (
          <p className="py-8 text-center text-slate-500">No bookings found</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Booking">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Guest</Label>
            <Select value={form.guestId} onChange={(e) => setForm({ ...form, guestId: e.target.value })} required>
              <option value="">Select guest</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.firstName} {g.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Room</Label>
            <Select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} required>
              <option value="">Select room</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} - {r.type} ({formatCurrency(r.pricePerNight)}/night)
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check-in Date</Label>
              <Input
                type="datetime-local"
                value={form.checkInDate}
                onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Check-out Date</Label>
              <Input
                type="datetime-local"
                value={form.checkOutDate}
                onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label>Adults</Label>
            <Input
              type="number"
              min="1"
              value={form.adults}
              onChange={(e) => setForm({ ...form, adults: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Booking
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
