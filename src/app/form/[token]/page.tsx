"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, FileText, Loader2, MapPin, Phone, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button, Card, CardContent, CountInput, Field, Input, Loading, Select, Textarea, Tip } from "@/components/ui";
import { addDays, diffDays } from "@/lib/dates";
import { shrinkPhoto } from "@/lib/client";
import { cn, formatDate, label } from "@/lib/utils";
import { FORM_ID_TYPES, INDIAN_STATES, MAX_FILES_PER_PERSON, isIndian, missingDocuments } from "@/lib/guest-form";

interface FormInfo {
  hotel: { name: string; phone: string | null; address: string | null; city: string | null; checkInTime: string; checkOutTime: string };
  status: string;
  today: string;
  phone: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  expiresAt: string;
  documents: Doc[];
}

interface Doc {
  id: string;
  person: string | null;
  type: string;
  fileName: string;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new Error("Cannot reach the hotel's server. Please check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: res.status });
  return data as T;
}

function splitName(name: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

type Draft = { f: Record<string, string | boolean>; adults: number; children: number; companions: { name: string; phone: string; aadhaarLast4?: string }[] };

function readDraft(token: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(`guest-form:${token}`) || "null");
    return d && typeof d.f === "object" && Array.isArray(d.companions) ? d : null;
  } catch {
    return null;
  }
}

/** The ID copies for one person: take a photo or choose a photo / PDF, then they upload straight away. */
function IdUpload({
  token,
  person,
  title,
  foreign,
  docs,
  onAdded,
  onRemoved,
  last4,
  onLast4,
}: {
  token: string;
  person: string;
  title: string;
  foreign: boolean;
  docs: Doc[];
  onAdded: (d: Doc) => void;
  onRemoved: (id: string) => void;
  last4: string;
  onLast4: (v: string) => void;
}) {
  const [type, setType] = useState(foreign ? "passport" : "aadhar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // On phones an input with `capture` only opens the camera, so choosing a saved photo or PDF needs its own input.
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const mine = docs.filter((d) => d.person === person);
  const full = mine.length >= MAX_FILES_PER_PERSON;

  useEffect(() => setType(foreign ? "passport" : "aadhar"), [foreign]);

  async function upload(chosen: File | undefined) {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      const file = await shrinkPhoto(chosen);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      fd.append("person", person);
      onAdded(await getJson<Doc>(`/api/public/guest-forms/${token}/documents`, { method: "POST", body: fd }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (picker.current) picker.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await getJson(`/api/public/guest-forms/${token}/documents?docId=${id}`, { method: "DELETE" });
      onRemoved(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className={cn("rounded-2xl border p-4", mine.length ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200")}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        {mine.length ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <UserRound className="h-5 w-5 text-slate-400" />}
        ID proof for {title}
      </p>
      {mine.length > 0 && (
        <ul className="mb-3 space-y-2">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary-600" />
                <span className="min-w-0">
                  <span className="block font-semibold">{label(d.type)}</span>
                  <span className="block truncate text-xs text-slate-500">{d.fileName}</span>
                </span>
              </span>
              <button type="button" onClick={() => remove(d.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${d.fileName}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {mine.some((d) => d.type === "aadhar") && (
        <Field label="Last 4 digits of the Aadhaar number" hint="Only these 4 digits are kept, to recognise you next time." className="mb-3">
          <Input
            value={last4}
            onChange={(e) => onLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="1234"
            className="max-w-32 text-center text-lg tracking-widest"
            required
          />
        </Field>
      )}
      {!full && (
        <>
          <Field label={mine.length ? "Add another page (for example the back side)" : "Which ID?"}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {FORM_ID_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </Select>
          </Field>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <input ref={picker} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => camera.current?.click()}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white px-2 py-4 text-sm font-semibold text-slate-700 hover:border-primary-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary-600" /> : <Camera className="h-6 w-6 text-primary-600" />}
              Take a photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => picker.current?.click()}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white px-2 py-4 text-sm font-semibold text-slate-700 hover:border-primary-400 disabled:opacity-50"
            >
              <FileText className="h-6 w-6 text-primary-600" />
              Choose photo or PDF
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export default function GuestFormPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    foreign: false,
    country: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    checkIn: "",
    checkOut: "",
    comingFrom: "",
    goingTo: "",
    vehicleNumber: "",
    requests: "",
    aadhaarLast4: "",
  });
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [companions, setCompanions] = useState<{ name: string; phone: string; aadhaarLast4?: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getJson<FormInfo>(`/api/public/guest-forms/${token}`)
      .then((i) => {
        setInfo(i);
        setDocs(i.documents);
        const checkIn = i.checkIn && i.checkIn >= i.today ? i.checkIn : i.today;
        const draft = readDraft(token);
        setF((old) => ({
          ...old,
          ...splitName(i.guestName),
          phone: i.phone,
          checkIn,
          checkOut: i.checkOut && i.checkOut > checkIn ? i.checkOut : addDays(checkIn, 1),
          ...draft?.f,
        }));
        if (draft) {
          setAdults(draft.adults);
          setChildren(draft.children);
          setCompanions(draft.companions);
        }
        setReady(true);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  // Phones sometimes reload the page after taking a photo, so what was typed is kept on the phone until the form is sent.
  useEffect(() => {
    if (!ready || sent) return;
    try {
      localStorage.setItem(`guest-form:${token}`, JSON.stringify({ f, adults, children, companions }));
    } catch {
      // Private browsing: nothing is kept, which is fine.
    }
  }, [ready, sent, token, f, adults, children, companions]);

  // One row for each adult staying with the guest.
  useEffect(() => {
    setCompanions((old) => (old.length === adults - 1 ? old : Array.from({ length: Math.max(0, adults - 1) }, (_, i) => old[i] ?? { name: "", phone: "", aadhaarLast4: "" })));
  }, [adults]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Tip tone="danger">{loadError}</Tip>
      </div>
    );
  }
  if (!info) return <Loading />;

  const hotel = info.hotel;
  const nationality = f.foreign ? f.country.trim() : "Indian";
  const indian = isIndian(nationality);
  const nights = f.checkIn && f.checkOut ? diffDays(f.checkIn, f.checkOut) : 0;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const header = (
    <header className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white">
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-100">Guest registration</p>
        <h1 className="mt-1 text-3xl font-bold">{hotel.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-primary-100">
          {(hotel.address || hotel.city) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {[hotel.address, hotel.city].filter(Boolean).join(", ")}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Check-in {hotel.checkInTime} · Check-out {hotel.checkOutTime}
          </span>
        </div>
      </div>
    </header>
  );

  const callHotel = hotel.phone && (
    <a href={`tel:${hotel.phone}`} className="inline-block">
      <Button variant="outline">
        <Phone className="h-4 w-4" /> Call {hotel.phone}
      </Button>
    </a>
  );

  if (sent || info.status !== "sent") {
    const done = sent || info.status === "submitted" || info.status === "booked";
    return (
      <div>
        {header}
        <main className="mx-auto -mt-12 max-w-2xl px-4 pb-16">
          <Card className="shadow-xl">
            <CardContent className="space-y-3 py-8 text-center">
              {done ? (
                <>
                  <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                  <p className="text-2xl font-bold">Thank you{f.firstName ? `, ${f.firstName}` : ""}!</p>
                  <p className="text-slate-600">Your details have reached {hotel.name}. The front desk will confirm your room with you.</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold">{info.status === "expired" ? "This link has expired" : "This form has been closed"}</p>
                  <p className="text-slate-600">Please ask the hotel to send you a new link.</p>
                </>
              )}
              <div className="pt-2">{callHotel}</div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      firstName: f.firstName,
      lastName: f.lastName,
      phone: f.phone,
      email: f.email,
      dateOfBirth: f.dateOfBirth,
      nationality: nationality || "",
      address: f.address,
      city: f.city,
      state: f.state,
      pinCode: f.pinCode,
      checkIn: f.checkIn,
      checkOut: f.checkOut,
      adults,
      children,
      comingFrom: f.comingFrom,
      goingTo: f.goingTo,
      vehicleNumber: f.vehicleNumber,
      aadhaarLast4: f.aadhaarLast4,
      companions,
      requests: f.requests,
      consent,
    };
    if (f.foreign && !f.country.trim()) return setError("Please enter your country");
    if (companions.some((c) => !c.name.trim())) return setError("Please enter the name of each adult staying with you");
    const missing = missingDocuments({ firstName: f.firstName, nationality, aadhaarLast4: f.aadhaarLast4, companions }, docs);
    if (missing.length) return setError(missing[0]);
    setSending(true);
    try {
      await getJson(`/api/public/guest-forms/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setSent(true);
      try {
        localStorage.removeItem(`guest-form:${token}`);
      } catch {
        // nothing kept
      }
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {header}
      <main className="mx-auto -mt-12 max-w-2xl px-4 pb-16">
        <form onSubmit={submit} className="space-y-5">
          <Card className="shadow-xl">
            <CardContent className="space-y-4 py-5">
              <div>
                <h2 className="text-xl font-bold">Your stay</h2>
                <p className="text-sm text-slate-500">The hotel will confirm your room after you send this form.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Arrival">
                  <Input
                    type="date"
                    required
                    min={info.today}
                    value={f.checkIn}
                    onChange={(e) => setF({ ...f, checkIn: e.target.value, checkOut: f.checkOut > e.target.value ? f.checkOut : addDays(e.target.value, 1) })}
                  />
                </Field>
                <Field label="Leaving">
                  <Input type="date" required min={f.checkIn ? addDays(f.checkIn, 1) : undefined} value={f.checkOut} onChange={set("checkOut")} />
                </Field>
                <Field label="Adults">
                  <CountInput min={1} max={20} value={adults} onChange={setAdults} aria-label="adults" />
                </Field>
                <Field label="Children" hint="Under 18">
                  <CountInput min={0} max={20} value={children} onChange={setChildren} aria-label="children" />
                </Field>
              </div>
              {nights > 0 && (
                <p className="text-sm text-slate-500">
                  {nights} night{nights > 1 ? "s" : ""} · {formatDate(f.checkIn)} → {formatDate(f.checkOut)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-5">
              <h2 className="text-xl font-bold">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input value={f.firstName} onChange={set("firstName")} required autoComplete="given-name" maxLength={80} />
                </Field>
                <Field label="Last name">
                  <Input value={f.lastName} onChange={set("lastName")} autoComplete="family-name" maxLength={80} />
                </Field>
                <Field label="Mobile number">
                  <Input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} required autoComplete="tel" maxLength={20} />
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} required max={info.today} />
                </Field>
                <Field label="Email" optional className="sm:col-span-2">
                  <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={120} />
                </Field>
                <Field label="Nationality">
                  <Select value={f.foreign ? "other" : "indian"} onChange={(e) => setF({ ...f, foreign: e.target.value === "other" })}>
                    <option value="indian">Indian</option>
                    <option value="other">Another country</option>
                  </Select>
                </Field>
                {f.foreign && (
                  <Field label="Which country?">
                    <Input value={f.country} onChange={set("country")} required maxLength={40} autoComplete="country-name" />
                  </Field>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 font-semibold">Home address</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="House, street and area" className="sm:col-span-2">
                    <Input value={f.address} onChange={set("address")} required autoComplete="street-address" maxLength={200} />
                  </Field>
                  <Field label="City">
                    <Input value={f.city} onChange={set("city")} required autoComplete="address-level2" maxLength={60} />
                  </Field>
                  {indian ? (
                    <Field label="State">
                      <Select value={f.state} onChange={set("state")} required>
                        <option value="">Choose your state</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : (
                    <Field label="State or region" optional>
                      <Input value={f.state} onChange={set("state")} autoComplete="address-level1" maxLength={60} />
                    </Field>
                  )}
                  <Field label={indian ? "PIN code" : "Postal code"} optional={!indian}>
                    <Input
                      value={f.pinCode}
                      onChange={set("pinCode")}
                      required={indian}
                      inputMode={indian ? "numeric" : "text"}
                      maxLength={indian ? 7 : 12}
                      autoComplete="postal-code"
                    />
                  </Field>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 font-semibold">Your journey</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Coming from (city)">
                    <Input value={f.comingFrom} onChange={set("comingFrom")} required maxLength={80} />
                  </Field>
                  <Field label="Going to next (city)" optional>
                    <Input value={f.goingTo} onChange={set("goingTo")} maxLength={80} />
                  </Field>
                  <Field label="Vehicle number" optional hint="If you are coming in your own vehicle.">
                    <Input value={f.vehicleNumber} onChange={set("vehicleNumber")} className="uppercase" maxLength={20} />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {companions.length > 0 && (
            <Card>
              <CardContent className="space-y-4 py-5">
                <div>
                  <h2 className="text-xl font-bold">Adults staying with you</h2>
                  <p className="text-sm text-slate-500">Every adult needs an ID proof. Children do not.</p>
                </div>
                {companions.map((c, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-2">
                    <Field label={`Adult ${i + 2}: full name`}>
                      <Input
                        value={c.name}
                        onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                        required
                        maxLength={80}
                      />
                    </Field>
                    <Field label="Mobile number" optional>
                      <Input
                        type="tel"
                        inputMode="tel"
                        value={c.phone}
                        onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                        maxLength={20}
                      />
                    </Field>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 py-5">
              <div>
                <h2 className="text-xl font-bold">ID proof</h2>
                <p className="text-sm text-slate-500">
                  Upload a photo or PDF of a government photo ID: Aadhaar, passport, driving licence or voter ID.
                  {f.foreign
                    ? " Foreign guests: your passport and visa page."
                    : " For Aadhaar, add both sides, or the masked Aadhaar from the myAadhaar app or website (it hides the number)."}
                </p>
              </div>
              <IdUpload
                token={token}
                person="0"
                title={f.firstName.trim() ? `${f.firstName.trim()} (you)` : "yourself"}
                foreign={f.foreign}
                docs={docs}
                onAdded={(d) => setDocs((x) => [...x, d])}
                onRemoved={(id) => setDocs((x) => x.filter((d) => d.id !== id))}
                last4={f.aadhaarLast4}
                onLast4={(v) => setF({ ...f, aadhaarLast4: v })}
              />
              {companions.map((c, i) => (
                <IdUpload
                  key={i}
                  token={token}
                  person={String(i + 1)}
                  title={c.name.trim() || `adult ${i + 2}`}
                  foreign={f.foreign}
                  docs={docs}
                  onAdded={(d) => setDocs((x) => [...x, d])}
                  onRemoved={(id) => setDocs((x) => x.filter((d) => d.id !== id))}
                  last4={c.aadhaarLast4 ?? ""}
                  onLast4={(v) => setCompanions(companions.map((x, j) => (j === i ? { ...x, aadhaarLast4: v } : x)))}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-5">
              <Field label="Anything the hotel should know?" optional hint="Arrival time, extra bed, special requests.">
                <Textarea value={f.requests} onChange={set("requests")} rows={2} maxLength={500} />
              </Field>
              <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600" />
                <span>
                  I confirm these details are correct. I agree that {hotel.name} keeps them and the ID copies for guest registration, and shares them with the police
                  where the law asks for it.
                </span>
              </label>
              {error && <Tip tone="danger">{error}</Tip>}
              <Button type="submit" size="lg" className="w-full" loading={sending} disabled={!consent}>
                <ShieldCheck className="h-5 w-5" /> Send my details to the hotel
              </Button>
              <p className="text-center text-xs text-slate-500">Your details go only to {hotel.name}. This link works until {formatDate(info.expiresAt.slice(0, 10))}.</p>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
