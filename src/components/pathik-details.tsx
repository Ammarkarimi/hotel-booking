"use client";

// The details the police guest register (Pathik) asks for, typed at the desk on a new booking:
// the guest's full address and date of birth, the journey, and the other adults in the room.
// A guest form sent on WhatsApp asks the guest for the same things. With Pathik switched on
// (Settings → Hotel details) every box is compulsory; otherwise they are optional.
import { UserPlus, UserRound, X } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { INDIAN_STATES, VEHICLE_LABELS, VEHICLE_TYPES, hasOwnVehicle } from "@/lib/guest-form";

export type DeskAddress = { address: string; locality: string; city: string; district: string; state: string; pinCode: string; dateOfBirth: string };
export type DeskTravel = { comingFrom: string; goingTo: string; vehicleType: string; vehicleNumber: string; companions: { name: string; phone: string }[] };

export const emptyAddress: DeskAddress = { address: "", locality: "", city: "", district: "", state: "", pinCode: "", dateOfBirth: "" };
export const emptyTravel: DeskTravel = { comingFrom: "", goingTo: "", vehicleType: "", vehicleNumber: "", companions: [] };

/** A row of names for every adult after the first, keeping what was typed. */
export function sizeCompanions(list: DeskTravel["companions"], adults: number) {
  const n = Math.max(0, adults - 1);
  return list.length === n ? list : Array.from({ length: n }, (_, i) => list[i] ?? { name: "", phone: "" });
}

export function AddressFields({
  value,
  onChange,
  indian,
  today,
  required,
}: {
  value: DeskAddress;
  onChange: (v: DeskAddress) => void;
  indian: boolean;
  today: string;
  required: boolean;
}) {
  const set = (k: keyof DeskAddress) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const must = required;
  const mustIndian = required && indian;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="House and street" optional={!must} className="sm:col-span-3">
        <Input value={value.address} onChange={set("address")} maxLength={200} required={must} />
      </Field>
      <Field label="Area / locality" optional={!mustIndian}>
        <Input value={value.locality} onChange={set("locality")} maxLength={80} required={mustIndian} />
      </Field>
      <Field label="City" optional={!must}>
        <Input value={value.city} onChange={set("city")} maxLength={60} required={must} />
      </Field>
      <Field label="District" optional={!mustIndian}>
        <Input value={value.district} onChange={set("district")} maxLength={60} required={mustIndian} />
      </Field>
      <Field label="State" optional={!mustIndian}>
        {indian ? (
          <Select value={value.state} onChange={set("state")} required={mustIndian}>
            <option value="">Choose</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        ) : (
          <Input value={value.state} onChange={set("state")} maxLength={60} />
        )}
      </Field>
      <Field label={indian ? "PIN code" : "Postcode"} optional={!mustIndian}>
        <Input value={value.pinCode} onChange={set("pinCode")} inputMode={indian ? "numeric" : undefined} maxLength={12} required={mustIndian} />
      </Field>
      <Field label="Date of birth" optional={!must}>
        <Input type="date" value={value.dateOfBirth} onChange={set("dateOfBirth")} max={today} required={must} />
      </Field>
    </div>
  );
}

export function TravelFields({
  value,
  onChange,
  adults,
  onAdults,
  required,
}: {
  value: DeskTravel;
  onChange: (v: DeskTravel) => void;
  adults: number;
  /** Adds or takes off an adult (the number of adults on the booking changes with it). */
  onAdults: (n: number, companions: DeskTravel["companions"], removed?: number) => void;
  required: boolean;
}) {
  const set = (k: "comingFrom" | "goingTo" | "vehicleType") => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const setPerson = (i: number, k: "name" | "phone", v: string) => onChange({ ...value, companions: value.companions.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coming from (city)" optional={!required}>
          <Input value={value.comingFrom} onChange={set("comingFrom")} maxLength={80} required={required} />
        </Field>
        <Field label="Going to next (city)" optional={!required}>
          <Input value={value.goingTo} onChange={set("goingTo")} maxLength={80} required={required} />
        </Field>
        <Field label="How are they travelling?" optional={!required}>
          <Select value={value.vehicleType} onChange={set("vehicleType")} required={required}>
            <option value="">Choose</option>
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {VEHICLE_LABELS[v]}
              </option>
            ))}
          </Select>
        </Field>
        {hasOwnVehicle(value.vehicleType) && (
          <Field label="Vehicle number" optional>
            <Input value={value.vehicleNumber} onChange={(e) => onChange({ ...value, vehicleNumber: e.target.value.toUpperCase() })} maxLength={20} placeholder="GJ01AB1234" />
          </Field>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UserRound className="h-4 w-4 text-primary-600" /> Other adults in the room (wife, husband, family, friends)
        </p>
        {value.companions.length === 0 && <p className="text-sm text-slate-500">Only one adult on this booking. Children do not need names.</p>}
        {value.companions.map((c, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <Field label={`Adult ${i + 2}: full name`} optional={!required}>
                <Input value={c.name} onChange={(e) => setPerson(i, "name", e.target.value)} maxLength={80} required={required} />
              </Field>
              <Field label="Mobile number" optional>
                <Input type="tel" inputMode="tel" value={c.phone} onChange={(e) => setPerson(i, "phone", e.target.value)} maxLength={20} />
              </Field>
            </div>
            <Button
              variant="ghost"
              aria-label={`Take adult ${i + 2} off the booking`}
              onClick={() => onAdults(adults - 1, value.companions.filter((_, j) => j !== i), i)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {adults < 20 && (
          <Button size="sm" variant="outline" onClick={() => onAdults(adults + 1, [...value.companions, { name: "", phone: "" }])}>
            <UserPlus className="h-4 w-4" /> Add another adult
          </Button>
        )}
      </div>
    </div>
  );
}

/** IDs the desk can tick as seen: Aadhaar (never saved) and the other photo IDs. */
export const ID_CHECK_TYPES = ["aadhar", "passport", "driving_licence", "voter_id", "pan", "other"] as const;
const ID_LABELS: Record<(typeof ID_CHECK_TYPES)[number], string> = {
  aadhar: "Aadhaar card",
  passport: "Passport",
  driving_licence: "Driving licence",
  voter_id: "Voter ID",
  pan: "PAN card",
  other: "Other photo ID",
};

/** One adult's ID at the desk: which kind of ID, and whether staff have seen the original. */
export type DeskIdCheck = { idType: string; seen: boolean };

/**
 * "ID check" on New booking: for every adult, the kind of ID and a tick once the original has been
 * seen. Nothing is typed: no number or copy is saved. Required (every adult ticked) for a walk-in.
 */
export function IdCheckFields({
  people,
  value,
  onChange,
  required,
}: {
  people: { name: string; defaultType: string }[];
  value: DeskIdCheck[];
  onChange: (v: DeskIdCheck[]) => void;
  required: boolean;
}) {
  const row = (i: number): DeskIdCheck => value[i] ?? { idType: people[i].defaultType, seen: false };
  const set = (i: number, change: Partial<DeskIdCheck>) => onChange(people.map((_, j) => (j === i ? { ...row(j), ...change } : row(j))));
  return (
    <div className="space-y-2">
      {people.map((p, i) => {
        const r = row(i);
        return (
          <div
            key={i}
            className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${r.seen ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}
          >
            <p className="font-semibold text-slate-800">{p.name}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={r.idType} onChange={(e) => set(i, { idType: e.target.value })} className="w-48" aria-label={`ID of ${p.name}`}>
                {ID_CHECK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ID_LABELS[t]}
                  </option>
                ))}
              </Select>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={r.seen} onChange={(e) => set(i, { seen: e.target.checked })} />
                ID verified
              </label>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-slate-500">
        Look at the original ID and tick it. Nothing is typed or saved from it, only which kind of ID was seen.
        {required ? " Every adult must be ticked before price & payment." : " The guest is not here yet? Leave it and tick the IDs on the booking at check-in."}
      </p>
    </div>
  );
}
