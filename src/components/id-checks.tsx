"use client";

import { useState } from "react";
import { CheckCircle2, IdCard, QrCode, Undo2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Modal, Select, Tip } from "@/components/ui";
import { AadhaarScanDialog } from "@/components/aadhaar-scan";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { DOCUMENT_TYPES, formatDateTime, label } from "@/lib/utils";
import type { BookingDTO, IdCheckDTO } from "@/lib/types";

type Person = { key: string | null; name: string; aadhaar: boolean };

/** Every adult in the room: the guest, the others named on the guest form, then any unnamed adults. */
export function bookingAdults(b: Pick<BookingDTO, "guestName" | "guest" | "companions" | "adults">): Person[] {
  const people: Person[] = [
    { key: null, name: b.guestName, aadhaar: b.guest.idType === "aadhar" },
    ...b.companions.map((c) => ({ key: c.name, name: c.name, aadhaar: !!c.aadhaarAtDesk })),
  ];
  for (let i = people.length; i < b.adults; i++) people.push({ key: `Adult ${i + 1}`, name: `Adult ${i + 1}`, aadhaar: false });
  return people;
}

function checkText(c: IdCheckDTO) {
  return c.method === "aadhaar_qr" ? "Aadhaar verified with its QR code" : `${label(c.idType)} checked`;
}

/** ID check at the front desk: scan each adult's Aadhaar QR, or note another ID that was seen. */
export function IdCheckCard({ booking: b, onChanged }: { booking: BookingDTO; onChanged: () => void }) {
  const { toast, confirm, user, isAdmin, settings } = useApp();
  const [scanFor, setScanFor] = useState<Person | null>(null);
  const [otherFor, setOtherFor] = useState<Person | null>(null);
  const [otherType, setOtherType] = useState("driving_licence");
  const [saving, setSaving] = useState(false);
  const people = bookingAdults(b);
  const closed = b.status === "cancelled" || b.status === "no_show";
  const checkFor = (p: Person) => [...b.idChecks].reverse().find((c) => (c.person ?? null) === p.key);
  const done = people.filter((p) => checkFor(p)).length;

  async function save(p: Person, body: Record<string, unknown>) {
    await api(`/api/bookings/${b.id}/id-checks`, { body: { person: p.key, ...body } });
    toast(body.method === "aadhaar_qr" ? `Aadhaar verified for ${p.name}` : `ID checked for ${p.name}`);
    onChanged();
  }

  async function saveOther() {
    if (!otherFor) return;
    setSaving(true);
    try {
      await save(otherFor, { method: "id_seen", idType: otherType });
      setOtherFor(null);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function undo(c: IdCheckDTO, p: Person) {
    const ok = await confirm({ title: `Remove the ID check for ${p.name}?`, message: "Use this only if it was marked by mistake.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/bookings/${b.id}/id-checks?checkId=${c.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary-600" /> ID check
          </span>
        }
        description={`${done} of ${people.length} adult${people.length > 1 ? "s" : ""} checked`}
      />
      <ul className="divide-y divide-slate-100">
        {people.map((p) => {
          const c = checkFor(p);
          const copies = b.guest.documents?.filter((d) => (d.person ?? null) === p.key) ?? [];
          const canUndo = c && (isAdmin || (c.checkedById === user.id && Date.now() - new Date(c.createdAt).getTime() < 12 * 3600 * 1000));
          return (
            <li key={p.key ?? "guest"} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  {c ? (
                    <p className="flex items-center gap-1 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> {checkText(c)} · {c.checkedByName}, {formatDateTime(c.createdAt, settings.timezone)}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700">
                      {p.aadhaar ? "Will show Aadhaar: scan its QR code" : copies.length ? `Copy uploaded: ${[...new Set(copies.map((d) => label(d.type)))].join(", ")}. Check the original.` : "Not checked yet"}
                    </p>
                  )}
                </div>
                {canUndo && (
                  <button onClick={() => undo(c, p)} className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600" aria-label={`Remove ID check for ${p.name}`}>
                    <Undo2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!c && !closed && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setScanFor(p)}>
                    <QrCode className="h-4 w-4" /> Scan Aadhaar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOtherFor(p)}>
                    Other ID
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-5 pb-4 text-xs text-slate-500">Nothing from an Aadhaar is saved: only who checked it and when.</p>

      <AadhaarScanDialog
        open={!!scanFor}
        onClose={() => setScanFor(null)}
        personName={scanFor?.name.startsWith("Adult ") ? "" : (scanFor?.name ?? "")}
        onVerified={async () => {
          if (!scanFor) return;
          try {
            await save(scanFor, { method: "aadhaar_qr" });
          } catch (e) {
            toast((e as Error).message, "error");
            throw e;
          }
        }}
      />
      <Modal
        open={!!otherFor}
        onClose={() => setOtherFor(null)}
        title={`Other ID: ${otherFor?.name ?? ""}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOtherFor(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveOther}>
              <CheckCircle2 className="h-4 w-4" /> I checked it
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Which ID did you see?">
            <Select value={otherType} onChange={(e) => setOtherType(e.target.value)}>
              {DOCUMENT_TYPES.filter((t) => t !== "visa").map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Tip>Look at the original ID and check that the photo is the guest. To keep a copy, upload it on the guest’s page.</Tip>
        </div>
      </Modal>
    </Card>
  );
}
