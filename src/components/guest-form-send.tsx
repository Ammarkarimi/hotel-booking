"use client";

import { useEffect, useState } from "react";
import { Copy, FileText, MessageCircle } from "lucide-react";
import { Button, Field, Input, Modal, Row, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { formMessage, fullAddress, isIndian } from "@/lib/guest-form";
import { formatDate, label } from "@/lib/utils";
import type { DocumentDTO, GuestFormDTO } from "@/lib/types";

export function formUrl(token: string) {
  return `${window.location.origin}/form/${token}`;
}

export function formWhatsapp(form: Pick<GuestFormDTO, "token" | "phone" | "guestName">, hotelName: string) {
  return whatsappLink(form.phone, formMessage({ hotelName, guestName: form.guestName, url: formUrl(form.token) }));
}

/** The link ready to send: WhatsApp opens only when staff tap the button, so phones never block it. */
export function SendLink({ form, onDone }: { form: GuestFormDTO; onDone: () => void }) {
  const { settings, toast } = useApp();
  async function copy() {
    try {
      await navigator.clipboard.writeText(formUrl(form.token));
      toast("Link copied");
    } catch {
      toast("Could not copy. Please send it on WhatsApp.", "error");
    }
  }
  return (
    <div className="space-y-3">
      <Tip tone="success">
        The form for <b>{form.guestName || form.phone}</b> is ready. Tap the green button and press Send in WhatsApp.
      </Tip>
      <a href={formWhatsapp(form, settings.hotelName)} target="_blank" rel="noopener noreferrer" className="block" onClick={() => setTimeout(onDone, 300)}>
        <Button variant="success" size="lg" className="w-full">
          <MessageCircle className="h-5 w-5" /> Send on WhatsApp to {form.phone}
        </Button>
      </a>
      <Button variant="outline" className="w-full" onClick={copy}>
        <Copy className="h-4 w-4" /> Copy the link instead
      </Button>
    </div>
  );
}

/** Staff type the guest's number (and dates if known); the guest gets the form on WhatsApp. */
export function SendGuestFormDialog({
  open,
  onClose,
  onSent,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: (form: GuestFormDTO) => void;
  initial?: { phone?: string; guestName?: string };
}) {
  const { settings, toast } = useApp();
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<GuestFormDTO | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone(initial?.phone ?? "");
    setGuestName(initial?.guestName ?? "");
    setCheckIn("");
    setCheckOut("");
    setCreated(null);
  }, [open, initial?.phone, initial?.guestName]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = await api<GuestFormDTO>("/api/guest-forms", { body: { phone, guestName, checkIn, checkOut: checkIn ? checkOut : "" } });
      setCreated(form);
      onSent?.(form);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send guest form on WhatsApp"
      description="The guest fills in their details and uploads ID copies. You then choose the room."
    >
      {created ? (
        <SendLink form={created} onDone={onClose} />
      ) : (
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guest's WhatsApp number">
              <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus placeholder="98765 43210" />
            </Field>
            <Field label="Guest's name" optional>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Arrival" optional hint="If you already know the dates.">
              <Input
                type="date"
                value={checkIn}
                min={settings.today}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (e.target.value && (!checkOut || checkOut <= e.target.value)) setCheckOut(addDays(e.target.value, 1));
                }}
              />
            </Field>
            <Field label="Leaving" optional>
              <Input type="date" value={checkOut} min={checkIn ? addDays(checkIn, 1) : undefined} disabled={!checkIn} onChange={(e) => setCheckOut(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              <MessageCircle className="h-4 w-4" /> Make the form
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Opens an ID copy the guest uploaded. */
export function DocumentLinks({ documents, fallbackName }: { documents: DocumentDTO[]; fallbackName?: string }) {
  if (documents.length === 0) return <p className="text-sm text-amber-700">No ID copies.</p>;
  return (
    <ul className="space-y-1.5">
      {documents.map((d) => (
        <li key={d.id}>
          <a
            href={`/api/uploads?path=${encodeURIComponent(d.filePath)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-primary-50"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary-600" />
            <span className="min-w-0">
              <span className="font-semibold">{label(d.type)}</span>
              <span className="text-slate-500"> · {d.person ?? fallbackName ?? "Guest"}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Everything the guest filled in, for the desk to check before choosing a room. */
export function FormDetails({ form }: { form: GuestFormDTO }) {
  const d = form.details;
  if (!d) return null;
  const name = `${d.firstName} ${d.lastName}`.trim();
  return (
    <div className="grid gap-x-8 gap-y-1 text-[15px] lg:grid-cols-2">
      <div>
        <Row label="Stay">
          {formatDate(d.checkIn)} → {formatDate(d.checkOut)}
        </Row>
        <Row label="People">
          {d.adults} adult{d.adults > 1 ? "s" : ""}
          {d.children > 0 && `, ${d.children} child${d.children > 1 ? "ren" : ""}`}
        </Row>
        <Row label="Mobile">{d.phone}</Row>
        {d.email && <Row label="Email">{d.email}</Row>}
        <Row label="Date of birth">{formatDate(d.dateOfBirth)}</Row>
        <Row label="Nationality">{isIndian(d.nationality) ? "Indian" : d.nationality}</Row>
        {d.aadhaarAtDesk && <Row label="ID">Aadhaar: scan the QR at check-in</Row>}
        <Row label="Address">
          <span className="text-right">{fullAddress(d)}</span>
        </Row>
        <Row label="Coming from">{d.comingFrom}</Row>
        {d.goingTo && <Row label="Going to">{d.goingTo}</Row>}
        {d.vehicleNumber && <Row label="Vehicle">{d.vehicleNumber.toUpperCase()}</Row>}
        {d.companions.length > 0 && (
          <Row label="Staying with">
            <span className="text-right">{d.companions
                .map((c) => c.name + [c.phone, c.aadhaarAtDesk && "Aadhaar at check-in"].filter(Boolean).map((x) => ` (${x})`).join(""))
                .join(", ")}</span>
          </Row>
        )}
        {d.requests && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">“{d.requests}”</p>}
      </div>
      <div className="mt-3 lg:mt-0">
        <p className="mb-2 text-sm font-semibold text-slate-700">ID copies</p>
        <DocumentLinks documents={form.documents} fallbackName={name} />
      </div>
    </div>
  );
}
