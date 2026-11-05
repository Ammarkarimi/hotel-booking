"use client";

// The details the police guest register (Pathik) asks for, typed at the desk on a new booking:
// the guest's full address and date of birth, the journey, and the other adults in the room.
// A guest form sent on WhatsApp asks the guest for the same things.
import { UserRound } from "lucide-react";
import { Field, Input, Select } from "@/components/ui";
import { INDIAN_STATES, VEHICLE_LABELS, VEHICLE_TYPES, hasOwnVehicle } from "@/lib/guest-form";

export type DeskAddress = { dateOfBirth: string; locality: string; city: string; district: string; state: string; pinCode: string };
export type DeskTravel = { comingFrom: string; goingTo: string; vehicleType: string; vehicleNumber: string; companions: { name: string; phone: string }[] };

export const emptyAddress: DeskAddress = { dateOfBirth: "", locality: "", city: "", district: "", state: "", pinCode: "" };
export const emptyTravel: DeskTravel = { comingFrom: "", goingTo: "", vehicleType: "", vehicleNumber: "", companions: [] };

/** A row of names for every adult after the first, keeping what was typed. */
export function sizeCompanions(list: DeskTravel["companions"], adults: number) {
  const n = Math.max(0, adults - 1);
  return list.length === n ? list : Array.from({ length: n }, (_, i) => list[i] ?? { name: "", phone: "" });
}

export function AddressFields({ value, onChange, indian, today }: { value: DeskAddress; onChange: (v: DeskAddress) => void; indian: boolean; today: string }) {
  const set = (k: keyof DeskAddress) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Area / locality" optional>
        <Input value={value.locality} onChange={set("locality")} maxLength={80} />
      </Field>
      <Field label="City" optional>
        <Input value={value.city} onChange={set("city")} maxLength={60} />
      </Field>
      <Field label="District" optional>
        <Input value={value.district} onChange={set("district")} maxLength={60} />
      </Field>
      <Field label="State" optional>
        {indian ? (
          <Select value={value.state} onChange={set("state")}>
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
      <Field label={indian ? "PIN code" : "Postcode"} optional>
        <Input value={value.pinCode} onChange={set("pinCode")} inputMode={indian ? "numeric" : undefined} maxLength={12} />
      </Field>
      <Field label="Date of birth" optional>
        <Input type="date" value={value.dateOfBirth} onChange={set("dateOfBirth")} max={today} />
      </Field>
    </div>
  );
}

export function TravelFields({ value, onChange }: { value: DeskTravel; onChange: (v: DeskTravel) => void }) {
  const set = (k: "comingFrom" | "goingTo" | "vehicleType" | "vehicleNumber") => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const setPerson = (i: number, k: "name" | "phone", v: string) => onChange({ ...value, companions: value.companions.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coming from (city)" optional>
          <Input value={value.comingFrom} onChange={set("comingFrom")} maxLength={80} />
        </Field>
        <Field label="Going to next (city)" optional>
          <Input value={value.goingTo} onChange={set("goingTo")} maxLength={80} />
        </Field>
        <Field label="How are they travelling?" optional>
          <Select value={value.vehicleType} onChange={set("vehicleType")}>
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
      {value.companions.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserRound className="h-4 w-4 text-primary-600" /> Other adults in the room
          </p>
          {value.companions.map((c, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              <Field label={`Adult ${i + 2}: full name`} optional>
                <Input value={c.name} onChange={(e) => setPerson(i, "name", e.target.value)} maxLength={80} />
              </Field>
              <Field label="Mobile number" optional>
                <Input type="tel" inputMode="tel" value={c.phone} onChange={(e) => setPerson(i, "phone", e.target.value)} maxLength={20} />
              </Field>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
