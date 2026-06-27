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
}

export default function GuestsClient() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "Indian",
    address: "",
  });
  const [docForm, setDocForm] = useState({ type: "aadhar", file: null as File | null });

  async function loadGuests(q?: string) {
    const url = q ? `/api/guests?search=${encodeURIComponent(q)}` : "/api/guests";
    const res = await fetch(url);
    const data = await res.json();
    setGuests(data);
    setLoading(false);
  }

  useEffect(() => {
    loadGuests();
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

    await fetch(`/api/guests/${selectedGuest.id}/documents`, {
      method: "POST",
      body: formData,
    });

    setDocModalOpen(false);
    loadGuests();
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
    </div>
  );
}
