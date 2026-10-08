"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, CalendarPlus, FileText, MessageCircle, Pencil, Phone, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Loading, Modal, Row, Select, StatCard, StatusBadge, Tip } from "@/components/ui";
import { GuestFormDialog } from "@/components/guest-form";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { DOCUMENT_TYPES, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { BookingDTO, DocumentDTO, GuestDTO } from "@/lib/types";

type GuestDetail = GuestDTO & {
  documents: DocumentDTO[];
  bookings: BookingDTO[];
  summary: { stays: number; nights: number; spent: number; owed: number };
};

function UploadDialog({ guest, open, onClose, onDone }: { guest: GuestDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const foreign = guest.nationality.toLowerCase() !== "indian";
  const [type, setType] = useState(foreign ? "passport" : "aadhar");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setType(foreign ? "passport" : "aadhar");
    }
  }, [open, foreign]);

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      await api(`/api/guests/${guest.id}/documents`, { body: fd });
      toast("ID document saved");
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save ID proof"
      description="Take a photo with your phone camera or choose a file (photo or PDF, up to 8 MB)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!file}>
            Save document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Which document?">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </Select>
        </Field>
        <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-slate-600 hover:border-primary-400 hover:bg-primary-50">
          <Camera className="h-8 w-8 text-primary-600" />
          <span className="font-semibold">{file ? file.name : "Tap to take a photo or choose a file"}</span>
          {file && <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB · tap to change</span>}
        </button>
      </div>
    </Modal>
  );
}

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, toast, isAdmin } = useApp();
  const [g, setG] = useState<GuestDetail | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    api<GuestDetail>(`/api/guests/${id}`).then(setG).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => load(), [load]);

  if (error) return <EmptyState title="Guest not found" description={error} />;
  if (!g) return <Loading />;

  const name = `${g.firstName} ${g.lastName}`.trim();
  const foreign = g.nationality.toLowerCase() !== "indian";

  async function removeDoc(doc: DocumentDTO) {
    const ok = await confirm({ title: "Delete this document?", message: `${label(doc.type)} — ${doc.fileName}`, confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/guests/${id}/documents?docId=${doc.id}`, { method: "DELETE" });
      toast("Document deleted");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removeGuest() {
    const ok = await confirm({ title: `Delete ${name}?`, message: "The guest record and their ID documents will be removed permanently.", confirmText: "Yes, delete", danger: true });
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
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">
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

      <div className="grid gap-6 lg:grid-cols-3">
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
            <Row label="ID">{g.idType ? `${label(g.idType)} ${g.idNumber ?? ""}` : "—"}</Row>
            {foreign && <Row label="Passport">{g.passportNo || "—"}</Row>}
            {foreign && <Row label="Visa">{g.visaNo || "—"}</Row>}
            {g.dateOfBirth && <Row label="Date of birth">{formatDate(g.dateOfBirth.slice(0, 10))}</Row>}
            {g.address && <Row label="Address">{g.address}</Row>}
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
          <CardHeader
            title="ID documents"
            description={foreign ? "Passport and visa are required for foreign guests." : "Aadhaar, driving licence or any government photo ID."}
            action={
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Add
              </Button>
            }
          />
          {g.documents.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-amber-700">No ID photo saved yet.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
                <Camera className="h-4 w-4" /> Take photo of ID
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {g.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <a href={`/api/uploads?path=${encodeURIComponent(d.filePath)}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                    <FileText className="h-5 w-5 shrink-0 text-primary-600" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{label(d.type)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {d.fileName} · {formatDateTime(d.createdAt)}
                      </span>
                    </span>
                  </a>
                  <button onClick={() => removeDoc(d)} className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete document">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
      <UploadDialog guest={g} open={uploadOpen} onClose={() => setUploadOpen(false)} onDone={load} />
    </div>
  );
}
