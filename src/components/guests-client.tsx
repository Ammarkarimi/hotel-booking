"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, FileText, Search } from "lucide-react";
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
import { DOCUMENT_TYPES } from "@/lib/utils";

interface GuestDocument {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  nationality: string;
  address: string | null;
  documents: GuestDocument[];
  bookings: Array<{
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    actualCheckIn: string | null;
    actualCheckOut: string | null;
    room: { roomNumber: string; type: string };
  }>;
}

export default function GuestsClient() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [selectedBookingGuest, setSelectedBookingGuest] = useState<Guest | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; roomNumber: string; type: string; pricePerNight: number }>>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "Indian",
    address: "",
  });
  const [assignForm, setAssignForm] = useState({
    roomId: "",
    checkInDate: "",
    checkOutDate: "",
    adults: "1",
    notes: "",
  });
  const [docForm, setDocForm] = useState({ type: "aadhar", file: null as File | null });

  async function loadGuests(q?: string) {
    const url = q ? `/api/guests?search=${encodeURIComponent(q)}` : "/api/guests";
    const res = await fetch(url);
    const data = await res.json();
    setGuests(data);
    setLoading(false);
  }

  async function loadAvailableRooms() {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setAvailableRooms(data.filter((room: { status: string }) => room.status === "available"));
  }

  useEffect(() => {
    loadGuests();
    loadAvailableRooms();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadGuests(search);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setModalOpen(false);
    setForm({ firstName: "", lastName: "", email: "", phone: "", nationality: "Indian", address: "" });
    loadGuests();
  }

  function openDocModal(guest: Guest) {
    setSelectedGuest(guest);
    const isIndian = guest.nationality.toLowerCase() === "indian";
    setDocForm({ type: isIndian ? "aadhar" : "passport", file: null });
    setDocModalOpen(true);
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGuest || !docForm.file) return;

    const formData = new FormData();
    formData.append("file", docForm.file);
    formData.append("type", docForm.type);

    const res = await fetch(`/api/guests/${selectedGuest.id}/documents`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to upload document");
      return;
    }

    setDocModalOpen(false);
    setSelectedGuest(null);
    loadGuests();
  }

  function openDetailsModal(guest: Guest) {
    setSelectedGuest(guest);
    setDetailsModalOpen(true);
  }

  function openAssignRoomModal(guest: Guest) {
    setSelectedBookingGuest(guest);
    setAssignForm({ roomId: "", checkInDate: "", checkOutDate: "", adults: "1", notes: "" });
    setAssignModalOpen(true);
  }

  async function handleAssignRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBookingGuest) return;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: selectedBookingGuest.id,
        roomId: assignForm.roomId,
        checkInDate: assignForm.checkInDate,
        checkOutDate: assignForm.checkOutDate,
        adults: parseInt(assignForm.adults, 10),
        notes: assignForm.notes,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to create booking");
      return;
    }

    setAssignModalOpen(false);
    setSelectedBookingGuest(null);
    loadGuests();
    loadAvailableRooms();
  }

  function getRequiredDocs(nationality: string) {
    if (nationality.toLowerCase() === "indian") {
      return ["Aadhar Card", "PAN Card"];
    }
    return ["Passport"];
  }

  if (loading) return <div className="text-slate-500">Loading guests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guest Management</h1>
          <p className="text-slate-500">Register guests and manage identity documents</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Register Guest
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="space-y-3">
        {guests.map((guest) => (
          <Card key={guest.id}>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {guest.firstName} {guest.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">{guest.phone}</p>
                  {guest.email && <p className="text-sm text-slate-500">{guest.email}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="info">{guest.nationality}</Badge>
                    {guest.address && (
                      <span className="text-xs text-slate-400">{guest.address}</span>
                    )}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => openDocModal(guest)}>
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Required: {getRequiredDocs(guest.nationality).join(", ")}
                </p>
                {guest.documents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {guest.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={`/api/uploads?path=${encodeURIComponent(doc.filePath)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-primary-600" />
                        <span className="capitalize">{doc.type}</span>
                        <span className="text-slate-400">({doc.fileName})</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">No documents uploaded yet</p>
                )}
              </div>
              {guest.bookings.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium text-slate-700">Recent bookings</p>
                  <ul className="space-y-1">
                    {guest.bookings.slice(0, 3).map((booking) => (
                      <li key={booking.id}>
                        Room {booking.room.roomNumber} ({booking.room.type}) · {booking.status.replace("_", " ")} · {new Date(booking.checkInDate).toLocaleDateString("en-IN")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => openDetailsModal(guest)}>
                  View Details
                </Button>
                <Button onClick={() => openAssignRoomModal(guest)}>
                  Assign Room
                </Button>
                <Button variant="danger" onClick={async () => {
                  if (!confirm(`Delete guest ${guest.firstName} ${guest.lastName}?`)) return;
                  const res = await fetch(`/api/guests/${guest.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || "Could not delete guest");
                    return;
                  }
                  loadGuests();
                }}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Register Guest">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Nationality</Label>
            <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Register
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={docModalOpen} onClose={() => setDocModalOpen(false)} title="Upload Identity Document">
        <form onSubmit={handleDocUpload} className="space-y-4">
          <div>
            <Label>Document Type</Label>
            <Select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>File (PDF, JPG, PNG)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setDocModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!docForm.file}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Guest Details">
        {selectedGuest ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">{selectedGuest.email || "No email"}</p>
              <p className="text-sm text-slate-500">{selectedGuest.phone}</p>
              <p className="text-sm text-slate-500">{selectedGuest.address || "No address"}</p>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Documents</h4>
              {selectedGuest.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedGuest.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/api/uploads?path=${encodeURIComponent(doc.filePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="capitalize">{doc.type}</span>
                      <span className="text-slate-400">{doc.fileName}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-600">No documents uploaded yet</p>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Booking history</h4>
              {selectedGuest.bookings.length > 0 ? (
                <div className="space-y-2">
                  {selectedGuest.bookings.map((booking) => (
                    <div key={booking.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <p>
                        Room {booking.room.roomNumber} ({booking.room.type}) · {booking.status.replace("_", " ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(booking.checkInDate).toLocaleDateString("en-IN")} - {new Date(booking.checkOutDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-600">No bookings yet</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
              <Button onClick={() => {
                if (selectedGuest) openAssignRoomModal(selectedGuest);
                setDetailsModalOpen(false);
              }}>
                Assign Room
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading details...</p>
        )}
      </Modal>

      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={selectedBookingGuest ? `Assign Room to ${selectedBookingGuest.firstName}` : "Assign Room"}>
        <form onSubmit={handleAssignRoom} className="space-y-4">
          <div>
            <Label>Room</Label>
            <Select value={assignForm.roomId} onChange={(e) => setAssignForm({ ...assignForm, roomId: e.target.value })} required>
              <option value="">Select room</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.roomNumber} - {room.type} ({room.pricePerNight.toLocaleString("en-IN")}/night)
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check-in Date</Label>
              <Input
                type="datetime-local"
                value={assignForm.checkInDate}
                onChange={(e) => setAssignForm({ ...assignForm, checkInDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Check-out Date</Label>
              <Input
                type="datetime-local"
                value={assignForm.checkOutDate}
                onChange={(e) => setAssignForm({ ...assignForm, checkOutDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label>Adults</Label>
            <Input
              type="number"
              min="1"
              value={assignForm.adults}
              onChange={(e) => setAssignForm({ ...assignForm, adults: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Assign Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
