"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ExternalLink, KeyRound, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Textarea, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { ROOM_TYPES, formatDate, formatDateTime, label } from "@/lib/utils";
import type { SettingsDTO } from "@/lib/types";

type Tab = "hotel" | "prices" | "website" | "staff" | "activity";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Colombo", "Asia/Singapore", "Europe/London", "America/New_York", "UTC"];

function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-4 mt-6 flex justify-end">
      <Button size="lg" loading={saving} onClick={onSave} className="shadow-lg">
        Save changes
      </Button>
    </div>
  );
}

function HotelTab({ s, set }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void }) {
  return (
    <Card>
      <CardHeader title="Hotel details" description="Printed on invoices and confirmations, and shown on your booking website." />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Hotel name">
          <Input value={s.hotelName} onChange={(e) => set({ hotelName: e.target.value })} />
        </Field>
        <Field label="Short tagline" optional>
          <Input value={s.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} placeholder="Comfortable stays near the station" />
        </Field>
        <Field label="Address" optional>
          <Input value={s.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="City, state, PIN" optional>
          <Input value={s.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Phone" optional>
          <Input value={s.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email" optional>
          <Input type="email" value={s.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="GSTIN" optional hint="Your GST number, printed on invoices.">
          <Input value={s.gstin ?? ""} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Invoice number prefix" hint={`Invoices will look like ${s.invoicePrefix || "INV"}-1024`}>
          <Input value={s.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} maxLength={10} />
        </Field>
        <Field label="Check-in time">
          <Input type="time" value={s.checkInTime} onChange={(e) => set({ checkInTime: e.target.value })} />
        </Field>
        <Field label="Check-out time">
          <Input type="time" value={s.checkOutTime} onChange={(e) => set({ checkOutTime: e.target.value })} />
        </Field>
        <Field label="Currency" hint="3-letter code, e.g. INR, USD, AED">
          <Input value={s.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} maxLength={3} />
        </Field>
        <Field label="Time zone" hint="Decides when “today” starts.">
          <Select value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {[...new Set([s.timezone, ...TIMEZONES])].map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

function PricesTab({ s, set, reload }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void; reload: () => void }) {
  const { toast, confirm } = useApp();
  const [rate, setRate] = useState({ name: "", startDate: "", endDate: "", roomType: "", percent: "" });
  const [adding, setAdding] = useState(false);

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api("/api/settings/seasonal-rates", { body: { ...rate, percent: Number(rate.percent), roomType: rate.roomType || null } });
      toast("Special price added");
      setRate({ name: "", startDate: "", endDate: "", roomType: "", percent: "" });
      reload();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }

  async function removeRate(id: string, name: string) {
    const ok = await confirm({ title: `Remove “${name}”?`, confirmText: "Remove", danger: true });
    if (!ok) return;
    await api(`/api/settings/seasonal-rates?id=${id}`, { method: "DELETE" });
    toast("Removed");
    reload();
  }

  function setSlab(i: number, key: "upTo" | "rate", value: string) {
    const slabs = s.gstSlabs.map((sl, j) => (j === i ? { ...sl, [key]: key === "upTo" ? (value === "" ? null : Number(value)) : Number(value) } : sl));
    set({ gstSlabs: slabs });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Tax" description="How tax is added to room bills." />
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { v: "india_gst", t: "Indian GST slabs (automatic)", d: "Tax rate depends on the room price per night." },
              { v: "flat", t: "One fixed tax rate", d: "Same % on every room bill." },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set({ taxMode: o.v })}
                className={"rounded-xl border-2 p-4 text-left " + (s.taxMode === o.v ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:bg-slate-50")}
              >
                <p className="font-semibold">{o.t}</p>
                <p className="text-sm text-slate-500">{o.d}</p>
              </button>
            ))}
          </div>
          {s.taxMode === "flat" ? (
            <Field label="Tax rate on rooms (%)" className="max-w-xs">
              <Input type="number" min={0} max={100} step="0.01" value={s.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) })} />
            </Field>
          ) : (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">GST slabs (price per night after discount)</p>
              <div className="space-y-2">
                {s.gstSlabs.map((sl, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-slate-600">{i === s.gstSlabs.length - 1 ? "Above that" : "Up to"}</span>
                    {i < s.gstSlabs.length - 1 && <Input type="number" min={0} value={sl.upTo ?? ""} onChange={(e) => setSlab(i, "upTo", e.target.value)} className="w-32" />}
                    <span className="text-slate-600">→ GST</span>
                    <Input type="number" min={0} max={100} step="0.01" value={sl.rate} onChange={(e) => setSlab(i, "rate", e.target.value)} className="w-24" />
                    <span>%</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Default follows Indian GST for hotel rooms (Sept 2025): up to ₹1,000 — 0%, up to ₹7,500 — 5%, above — 18%. Check with your accountant if rules change.</p>
            </div>
          )}
          <Field label="Tax on extras like food & laundry (%)" className="max-w-xs">
            <Input type="number" min={0} max={100} step="0.01" value={s.extrasTaxRate} onChange={(e) => set({ extrasTaxRate: Number(e.target.value) })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Weekend price" description="Change room prices on Friday and Saturday nights. Use 0 for no change." />
        <CardContent>
          <Field label="Weekend price change (%)" hint="e.g. 15 makes weekend nights 15% more expensive; -10 makes them 10% cheaper." className="max-w-xs">
            <Input type="number" min={-90} max={500} value={s.weekendSurcharge} onChange={(e) => set({ weekendSurcharge: Number(e.target.value) })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Special prices for dates" description="Festivals, holidays, events or off-season. Applies to new and existing bookings that are not on a special agreed price." />
        <CardContent className="space-y-4">
          {(s.seasonalRates ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No special prices yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {s.seasonalRates!.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <b>{r.name}</b> · {formatDate(r.startDate.slice(0, 10))} → {formatDate(r.endDate.slice(0, 10))} · {r.roomType ? label(r.roomType) : "All rooms"}{" "}
                    <Badge variant={r.percent > 0 ? "warning" : "success"}>
                      {r.percent > 0 ? "+" : ""}
                      {r.percent}%
                    </Badge>
                  </span>
                  <button onClick={() => removeRate(r.id, r.name)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addRate} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <Field label="Name" className="lg:col-span-2">
              <Input value={rate.name} onChange={(e) => setRate({ ...rate, name: e.target.value })} placeholder="Diwali" required />
            </Field>
            <Field label="From">
              <Input type="date" value={rate.startDate} onChange={(e) => setRate({ ...rate, startDate: e.target.value })} required />
            </Field>
            <Field label="To">
              <Input type="date" value={rate.endDate} min={rate.startDate} onChange={(e) => setRate({ ...rate, endDate: e.target.value })} required />
            </Field>
            <Field label="Rooms">
              <Select value={rate.roomType} onChange={(e) => setRate({ ...rate, roomType: e.target.value })}>
                <option value="">All rooms</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Change %">
              <Input type="number" value={rate.percent} onChange={(e) => setRate({ ...rate, percent: e.target.value })} placeholder="20" required />
            </Field>
            <Button type="submit" loading={adding} className="lg:col-span-6 lg:justify-self-end">
              <Plus className="h-4 w-4" /> Add special price
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function WebsiteTab({ s, set }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void }) {
  const { settings } = useApp();
  const path = `/book/${settings.bookingSlug}`;
  const link = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <Card>
      <CardHeader title="Online booking website" description="Guests can book directly with you from their phone — no commission." />
      <CardContent className="space-y-4">
        <Toggle checked={s.websiteEnabled} onChange={(v) => set({ websiteEnabled: v })} label="Accept bookings online" description="Turn off to stop new online bookings (for example, when you are full for the season)." />
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Your booking link:</span>
          <code className="rounded bg-white px-2 py-1 text-sm">{link}</code>
          <a href={path} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
          </a>
        </div>
        <Tip>Share this link on WhatsApp, Instagram, Google Maps and your visiting card. Online bookings appear in Bookings marked “Our website”.</Tip>
        <Field label="About your hotel" optional hint="A few friendly lines shown at the top of the booking page.">
          <Textarea value={s.websiteAbout ?? ""} onChange={(e) => set({ websiteAbout: e.target.value })} rows={3} />
        </Field>
        <Field label="Hotel rules / cancellation policy" optional hint="Shown to guests before they book and printed on confirmations.">
          <Textarea value={s.bookingTerms ?? ""} onChange={(e) => set({ bookingTerms: e.target.value })} rows={4} />
        </Field>
      </CardContent>
    </Card>
  );
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

function StaffTab() {
  const { toast, confirm, user } = useApp();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(() => {
    api<StaffRow[]>("/api/staff").then(setStaff).catch(() => setStaff([]));
  }, []);
  useEffect(() => load(), [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/staff", { body: form });
      toast(`${form.name} can now sign in`);
      setAddOpen(false);
      setForm({ name: "", email: "", password: "", role: "staff" });
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function update(s: StaffRow, body: Record<string, unknown>, msg: string) {
    try {
      await api(`/api/staff/${s.id}`, { method: "PUT", body });
      toast(msg);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function remove(s: StaffRow) {
    const ok = await confirm({ title: `Remove ${s.name}?`, message: "They will no longer be able to sign in. Their past actions stay in the activity history.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/staff/${s.id}`, { method: "DELETE" });
      toast("Staff account removed");
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!staff) return <Loading />;
  return (
    <Card>
      <CardHeader
        title="Staff accounts"
        description="Give each person their own sign-in so you can see who did what. Front-desk staff cannot see reports, change settings or delete records."
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
        }
      />
      <ul className="divide-y divide-slate-100">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {s.name} {s.id === user.id && <Badge variant="info">You</Badge>} {!s.active && <Badge variant="danger">Disabled</Badge>}
              </p>
              <p className="text-sm text-slate-500">
                {s.email} · {label(s.role)}
              </p>
            </div>
            {s.id !== user.id && (
              <div className="flex flex-wrap gap-2">
                <Select value={s.role} onChange={(e) => update(s, { role: e.target.value }, "Role changed")} className="min-h-9 w-44 py-1 text-sm">
                  <option value="staff">Front desk</option>
                  <option value="admin">Owner / Manager</option>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResetFor(s);
                    setNewPassword("");
                  }}
                >
                  <KeyRound className="h-4 w-4" /> Reset password
                </Button>
                <Button size="sm" variant="outline" onClick={() => update(s, { active: !s.active }, s.active ? "Account disabled" : "Account enabled")}>
                  {s.active ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a staff member">
        <form onSubmit={add} className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Email (used to sign in)">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Password" hint="At least 6 characters. They can change it later in My account.">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </Field>
          <Field label="Access">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Front desk — bookings, guests, payments, housekeeping</option>
              <option value="admin">Owner / Manager — everything incl. reports & settings</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add staff</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title={`New password for ${resetFor?.name ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={newPassword.length < 6}
              onClick={async () => {
                if (resetFor) await update(resetFor, { password: newPassword }, "Password changed. Tell the staff member their new password.");
                setResetFor(null);
              }}
            >
              Save password
            </Button>
          </>
        }
      >
        <Field label="New password" hint="At least 6 characters.">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </Card>
  );
}

function ActivityTab() {
  const [items, setItems] = useState<Array<{ id: string; staffName: string; action: string; details: string | null; createdAt: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((after?: string) => {
    setLoading(true);
    api<{ items: typeof items; nextCursor: string | null }>(`/api/activity${after ? `?cursor=${after}` : ""}`)
      .then((r) => {
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  return (
    <Card>
      <CardHeader title="Activity history" description="Every booking, payment, change and sign-in, with who did it." />
      {items.length === 0 && !loading ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <b>{a.staffName}</b> — {a.action}
                {a.details && <span className="text-slate-500">: {a.details}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <div className="p-4 text-center">
          <Button variant="outline" loading={loading} onClick={() => load(cursor)}>
            Show older
          </Button>
        </div>
      )}
    </Card>
  );
}

function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "hotel");
  const [s, setS] = useState<SettingsDTO | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<SettingsDTO>("/api/settings").then(setS).catch(() => undefined);
  }, []);
  useEffect(() => load(), [load]);

  if (!isAdmin) return <EmptyState title="Settings are for the owner / manager" />;
  if (!s) return <Loading />;

  const set = (p: Partial<SettingsDTO>) => setS((prev) => (prev ? { ...prev, ...p } : prev));

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const body: Partial<SettingsDTO> = { ...s };
      delete body.seasonalRates;
      await api("/api/settings", { method: "PUT", body });
      toast("Settings saved");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const changeTab = (t: Tab) => {
    setTab(t);
    router.replace(`/settings?tab=${t}`);
  };

  return (
    <div>
      <PageHeader title="Settings" description="Your hotel details, prices, tax, website and staff." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "hotel", label: "Hotel details" },
          { value: "prices", label: "Prices & tax" },
          { value: "website", label: "Online booking" },
          { value: "staff", label: "Staff" },
          { value: "activity", label: "Activity history" },
        ]}
      />
      {tab === "hotel" && <HotelTab s={s} set={set} />}
      {tab === "prices" && <PricesTab s={s} set={set} reload={load} />}
      {tab === "website" && <WebsiteTab s={s} set={set} />}
      {tab === "staff" && <StaffTab />}
      {tab === "activity" && <ActivityTab />}
      {(tab === "hotel" || tab === "prices" || tab === "website") && <SaveBar saving={saving} onSave={save} />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsView />
    </Suspense>
  );
}
