"use client";

import { useState } from "react";
import { CheckCircle2, IdCard, Undo2 } from "lucide-react";
import { Card, CardHeader, Select } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { DOCUMENT_TYPES, cn, formatDateTime, label } from "@/lib/utils";
import type { BookingDTO, IdCheckDTO } from "@/lib/types";

type Person = { key: string | null; name: string; aadhaar: boolean; copies: string[] };

/** IDs the front desk can tick as verified: Aadhaar (seen, never saved) and the other photo IDs. */
const CHECK_TYPES = ["aadhar", ...DOCUMENT_TYPES.filter((t) => t !== "visa")];

/** Every adult in the room: the guest, the others named on the guest form, then any unnamed adults. */
export function bookingAdults(b: Pick<BookingDTO, "guestName" | "guest" | "companions" | "adults">): Person[] {
  const copiesOf = (key: string | null) => [...new Set((b.guest.documents ?? []).filter((d) => (d.person ?? null) === key).map((d) => d.type))];
  const people: Person[] = [
    { key: null, name: b.guestName, aadhaar: b.guest.idType === "aadhar", copies: copiesOf(null) },
    ...b.companions.map((c) => ({ key: c.name, name: c.name, aadhaar: !!c.aadhaarAtDesk, copies: copiesOf(c.name) })),
  ];
  for (let i = people.length; i < b.adults; i++) people.push({ key: `Adult ${i + 1}`, name: `Adult ${i + 1}`, aadhaar: false, copies: [] });
  return people;
}

function checkText(c: IdCheckDTO) {
  return `${c.method === "aadhaar_qr" ? "Aadhaar card" : label(c.idType)} verified`;
}

function PersonRow({ b, p, onChanged }: { b: BookingDTO; p: Person; onChanged: () => void }) {
  const { toast, confirm, user, isAdmin, settings } = useApp();
  const check = [...b.idChecks].reverse().find((c) => (c.person ?? null) === p.key);
  const [idType, setIdType] = useState(p.aadhaar ? "aadhar" : (p.copies.find((t) => CHECK_TYPES.includes(t)) ?? "aadhar"));
  const [busy, setBusy] = useState(false);
  const closed = b.status === "cancelled" || b.status === "no_show";
  const canUndo = check && (isAdmin || (check.checkedById === user.id && Date.now() - new Date(check.createdAt).getTime() < 12 * 3600 * 1000));

  async function toggle() {
    if (busy || closed) return;
    if (check) {
      if (!canUndo) return toast("Only the owner can untick this.", "error");
      const ok = await confirm({ title: `Untick the ID for ${p.name}?`, message: "Use this only if it was ticked by mistake.", confirmText: "Untick", danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (check) await api(`/api/bookings/${b.id}/id-checks?checkId=${check.id}`, { method: "DELETE" });
      else {
        await api(`/api/bookings/${b.id}/id-checks`, { body: { person: p.key, idType } });
        toast(`ID verified for ${p.name}`);
      }
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-5 py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={!!check}
          aria-label={`ID verified for ${p.name}`}
          onClick={toggle}
          disabled={busy || closed || (!!check && !canUndo)}
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition disabled:cursor-not-allowed",
            check ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white hover:border-primary-500"
          )}
        >
          {check && <CheckCircle2 className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{p.name}</p>
          {check ? (
            <p className="text-sm text-emerald-700">
              {checkText(check)} · {check.checkedByName}, {formatDateTime(check.createdAt, settings.timezone)}
            </p>
          ) : (
            <>
              <p className="text-sm text-amber-700">
                {p.aadhaar
                  ? "Will show Aadhaar at check-in."
                  : p.copies.length
                    ? `Copy uploaded: ${p.copies.map(label).join(", ")}. Check the original.`
                    : "Not verified yet."}
              </p>
              {!closed && (
                <div className="mt-2 flex items-center gap-2">
                  <Select value={idType} onChange={(e) => setIdType(e.target.value)} className="h-10 w-48 py-1.5 text-sm" aria-label={`Which ID ${p.name} showed`}>
                    {CHECK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </Select>
                  <span className="text-xs text-slate-500">then tick the box</span>
                </div>
              )}
            </>
          )}
        </div>
        {check && canUndo && (
          <button onClick={toggle} className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600" aria-label={`Untick the ID for ${p.name}`}>
            <Undo2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

/** ID check at the front desk: the receptionist looks at each adult's original ID and ticks it as verified. */
export function IdCheckCard({ booking: b, onChanged }: { booking: BookingDTO; onChanged: () => void }) {
  const people = bookingAdults(b);
  const done = people.filter((p) => b.idChecks.some((c) => (c.person ?? null) === p.key)).length;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary-600" /> ID check
          </span>
        }
        description={`${done} of ${people.length} adult${people.length > 1 ? "s" : ""} verified`}
      />
      <ul className="divide-y divide-slate-100">
        {people.map((p) => (
          <PersonRow key={p.key ?? "guest"} b={b} p={p} onChanged={onChanged} />
        ))}
      </ul>
      <p className="px-5 pb-4 text-xs text-slate-500">Look at the original ID and check the photo is the guest, then tick. Nothing from an Aadhaar is saved: only who verified it and when.</p>
    </Card>
  );
}
