"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { label } from "@/lib/utils";
import type { GuestDTO } from "@/lib/types";

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  nationality: "Indian",
  address: "",
  idType: "aadhar",
  idNumber: "",
  company: "",
  gstin: "",
  dateOfBirth: "",
  passportNo: "",
  visaNo: "",
  notes: "",
  vip: false,
  blacklisted: false,
};

export function GuestFormDialog({
  open,
  onClose,
  guest,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  guest?: GuestDTO | null;
  onSaved: (g: GuestDTO) => void;
}) {
  const { toast } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (guest) {
      setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(guest).filter(([k, v]) => k in EMPTY && v !== null)),
        dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.slice(0, 10) : "",
      } as typeof EMPTY);
      setMore(!!(guest.company || guest.gstin || guest.passportNo || guest.notes));
    } else {
      setForm(EMPTY);
      setMore(false);
    }
  }, [open, guest]);

  const foreign = form.nationality.trim().toLowerCase() !== "indian";
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api<GuestDTO>(guest ? `/api/guests/${guest.id}` : "/api/guests", { method: guest ? "PUT" : "POST", body: form });
      toast(guest ? "Guest details saved" : "Guest added");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={guest ? "Edit guest" : "Add a guest"} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input value={form.firstName} onChange={set("firstName")} required autoFocus />
          </Field>
          <Field label="Last name" optional>
            <Input value={form.lastName} onChange={set("lastName")} />
          </Field>
          <Field label="Mobile number">
            <Input type="tel" value={form.phone} onChange={set("phone")} required />
          </Field>
          <Field label="Email" optional>
            <Input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Nationality">
            <Input value={form.nationality} onChange={set("nationality")} />
          </Field>
          <Field label="ID proof" optional>
            <div className="flex gap-2">
              <Select value={form.idType} onChange={set("idType")} className="w-40">
                {["aadhar", "passport", "driving_licence", "voter_id", "pan", "other"].map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
              <Input value={form.idNumber} onChange={set("idNumber")} placeholder="ID number" />
            </div>
          </Field>
          <Field label="Address" optional className="sm:col-span-2">
            <Input value={form.address} onChange={set("address")} />
          </Field>
          {foreign && (
            <>
              <Field label="Passport number" hint="Needed for foreign guest registration (Form C).">
                <Input value={form.passportNo} onChange={set("passportNo")} />
              </Field>
              <Field label="Visa number" optional>
                <Input value={form.visaNo} onChange={set("visaNo")} />
              </Field>
            </>
          )}
        </div>

        <button type="button" onClick={() => setMore((m) => !m)} className="text-sm font-semibold text-primary-600 hover:underline">
          {more ? "Hide" : "Show"} more details (company, GST, notes)
        </button>
        {more && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" optional>
              <Input value={form.company} onChange={set("company")} />
            </Field>
            <Field label="Company GSTIN" optional hint="Printed on the invoice for business guests.">
              <Input value={form.gstin} onChange={set("gstin")} className="uppercase" />
            </Field>
            <Field label="Date of birth" optional>
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
            <Field label="Notes" optional className="sm:col-span-2" hint="Preferences, allergies, anything to remember.">
              <Textarea value={form.notes} onChange={set("notes")} rows={2} />
            </Field>
            <Toggle checked={form.vip} onChange={(v) => setForm({ ...form, vip: v })} label="VIP guest" description="Shows a VIP tag on all bookings." />
            <Toggle checked={form.blacklisted} onChange={(v) => setForm({ ...form, blacklisted: v })} label="Do not allow" description="Warns staff when this guest tries to book." />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {guest ? "Save" : "Add guest"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
