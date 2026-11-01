"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button, CountInput, Field, Input, Modal, Select, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { INDIAN_STATES, isIndian, type GuestFormDetails } from "@/lib/guest-form";
import type { GuestFormDTO } from "@/lib/types";

type Person = { name: string; phone: string; aadhaarAtDesk: boolean };
type Draft = Omit<GuestFormDetails, "companions" | "consent" | "email"> & { email: string; companions: Person[] };

function draftOf(d: GuestFormDetails): Draft {
  return {
    ...d,
    email: d.email ?? "",
    companions: d.companions.map((c) => ({ name: c.name, phone: c.phone ?? "", aadhaarAtDesk: !!c.aadhaarAtDesk })),
  };
}

function Tick({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** The front desk corrects what the guest filled in on the WhatsApp form, before the booking is made. */
export function EditGuestFormDialog({ form, open, onClose, onSaved }: { form: GuestFormDTO; open: boolean; onClose: () => void; onSaved: (f: GuestFormDTO) => void }) {
  const { toast, confirm } = useApp();
  const [d, setD] = useState<Draft | null>(form.details ? draftOf(form.details) : null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && form.details) setD(draftOf(form.details));
  }, [open, form.details]);

  if (!d) return null;
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const indian = isIndian(d.nationality);
  const setPerson = (i: number, p: Partial<Person>) => set({ companions: d.companions.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  function setAdults(adults: number) {
    const companions = Array.from({ length: adults - 1 }, (_, i) => d!.companions[i] ?? { name: "", phone: "", aadhaarAtDesk: true });
    set({ adults, companions });
  }

  // Adults taken off the form lose the ID copies they uploaded.
  const before = form.details?.companions ?? [];
  const dropped = before.slice(d.companions.length).filter((c) => form.documents.some((doc) => doc.person === c.name));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (dropped.length) {
      const ok = await confirm({
        title: "Delete their ID copies?",
        message: `${dropped.map((c) => c.name).join(", ")} ${dropped.length > 1 ? "are" : "is"} no longer on the form, so the ID copies they uploaded will be deleted.`,
        confirmText: "Yes, save",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const updated = await api<GuestFormDTO>(`/api/guest-forms/${form.id}`, { body: { action: "edit", details: d } });
      toast("Details saved");
      onSaved(updated);
      onClose();
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
      size="lg"
      title="Change the guest's details"
      description="Correct anything the guest filled in. The booking and the guest's profile are made from these details."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-guest-form" loading={saving}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </>
      }
    >
      <form id="edit-guest-form" onSubmit={save} className="space-y-6">
        <Section title="Stay">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Arrival">
              <Input
                type="date"
                required
                value={d.checkIn}
                onChange={(e) => set({ checkIn: e.target.value, ...(e.target.value && d.checkOut <= e.target.value && { checkOut: addDays(e.target.value, 1) }) })}
              />
            </Field>
            <Field label="Leaving">
              <Input type="date" required value={d.checkOut} min={d.checkIn ? addDays(d.checkIn, 1) : undefined} onChange={(e) => set({ checkOut: e.target.value })} />
            </Field>
            <Field label="Adults">
              <CountInput min={1} max={20} value={d.adults} onChange={setAdults} aria-label="adults" />
            </Field>
            <Field label="Children">
              <CountInput min={0} max={20} value={d.children} onChange={(children) => set({ children })} aria-label="children" />
            </Field>
          </div>
        </Section>

        <Section title="Guest">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input required maxLength={80} value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} />
            </Field>
            <Field label="Last name" optional>
              <Input maxLength={80} value={d.lastName} onChange={(e) => set({ lastName: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input type="tel" inputMode="tel" required maxLength={20} value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Email" optional>
              <Input type="email" maxLength={120} value={d.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" required value={d.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
            </Field>
            <Field label="Nationality">
              <Input required maxLength={40} value={d.nationality} onChange={(e) => set({ nationality: e.target.value })} />
            </Field>
          </div>
          {indian && (
            <Tick checked={d.aadhaarAtDesk} onChange={(aadhaarAtDesk) => set({ aadhaarAtDesk })}>
              Will show Aadhaar at check-in
            </Tick>
          )}
        </Section>

        <Section title="Home address">
          <Field label="House and street">
            <Input required maxLength={200} value={d.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <Input required maxLength={60} value={d.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label="State" optional={!indian}>
              {indian ? (
                <Select required value={d.state} onChange={(e) => set({ state: e.target.value })}>
                  <option value="">Choose</option>
                  {[...new Set([...INDIAN_STATES, ...(d.state ? [d.state] : [])])].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input maxLength={60} value={d.state} onChange={(e) => set({ state: e.target.value })} />
              )}
            </Field>
            <Field label={indian ? "PIN code" : "Postcode"} optional={!indian}>
              <Input inputMode={indian ? "numeric" : undefined} required={indian} maxLength={12} value={d.pinCode} onChange={(e) => set({ pinCode: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Travel">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Coming from">
              <Input required maxLength={80} value={d.comingFrom} onChange={(e) => set({ comingFrom: e.target.value })} />
            </Field>
            <Field label="Going to next" optional>
              <Input maxLength={80} value={d.goingTo} onChange={(e) => set({ goingTo: e.target.value })} />
            </Field>
            <Field label="Vehicle number" optional>
              <Input maxLength={20} value={d.vehicleNumber} onChange={(e) => set({ vehicleNumber: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </Section>

        {d.companions.length > 0 && (
          <Section title="Other adults in the room">
            <div className="space-y-3">
              {d.companions.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={`Adult ${i + 2}: name`}>
                      <Input required maxLength={80} value={c.name} onChange={(e) => setPerson(i, { name: e.target.value })} />
                    </Field>
                    <Field label="Mobile" optional>
                      <Input type="tel" inputMode="tel" maxLength={20} value={c.phone} onChange={(e) => setPerson(i, { phone: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-2">
                    <Tick checked={c.aadhaarAtDesk} onChange={(aadhaarAtDesk) => setPerson(i, { aadhaarAtDesk })}>
                      Will show Aadhaar at check-in
                    </Tick>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
        {dropped.length > 0 && (
          <Tip tone="warning">
            {dropped.map((c) => c.name).join(", ")} will be taken off the form, and the ID copies they uploaded will be deleted.
          </Tip>
        )}

        <Section title="Special requests">
          <Textarea rows={3} maxLength={500} value={d.requests} onChange={(e) => set({ requests: e.target.value })} aria-label="Special requests" />
        </Section>
      </form>
    </Modal>
  );
}
