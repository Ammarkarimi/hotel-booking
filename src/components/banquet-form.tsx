"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Loading, NumberInput, Row, Select, Textarea, Tip } from "@/components/ui";
import { MethodPicker } from "@/components/booking-actions";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import {
  BANQUET_ITEM_CATEGORIES,
  banquetBill,
  EVENT_TYPES,
  FOOD_ITEM_CATEGORIES,
  FOOD_TYPES,
  SEATING_STYLES,
  SESSION_TIMES,
  SESSIONS,
} from "@/lib/banquet-bill";
import type { BanquetDTO, BanquetSetup, HallClash } from "@/lib/banquet-types";
import { cn, formatCurrency, label, PAYMENT_METHODS } from "@/lib/utils";

export interface BanquetFormValues {
  customerName: string;
  phone: string;
  email: string;
  company: string;
  gstin: string;
  address: string;
  eventType: string;
  eventName: string;
  hallId: string;
  eventDate: string;
  session: string;
  startTime: string;
  endTime: string;
  expectedPax: number | null;
  guaranteedPax: number | null;
  actualPax: number | null;
  seating: string;
  menuName: string;
  foodType: string;
  menuItems: string;
  platePrice: number | null;
  foodGst: number | null;
  hallRent: number | null;
  hallGst: number | null;
  discount: number | null;
  requirements: string;
  notes: string;
  followUpOn: string;
}

interface DraftItem {
  key: number;
  category: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  gstRate: number | null;
}

export function valuesFrom(b: BanquetDTO): BanquetFormValues {
  return {
    customerName: b.customerName,
    phone: b.phone,
    email: b.email ?? "",
    company: b.company ?? "",
    gstin: b.gstin ?? "",
    address: b.address ?? "",
    eventType: b.eventType,
    eventName: b.eventName ?? "",
    hallId: b.hallId,
    eventDate: b.eventDate,
    session: b.session,
    startTime: b.startTime,
    endTime: b.endTime,
    expectedPax: b.expectedPax,
    guaranteedPax: b.guaranteedPax,
    actualPax: b.actualPax,
    seating: b.seating ?? "",
    menuName: b.menuName ?? "",
    foodType: b.foodType,
    menuItems: b.menuItems ?? "",
    platePrice: b.platePrice,
    foodGst: b.foodGst,
    hallRent: b.hallRent,
    hallGst: b.hallGst,
    discount: b.discount,
    requirements: b.requirements ?? "",
    notes: b.notes ?? "",
    followUpOn: b.followUpOn ?? "",
  };
}

/** What the API expects: empty text as null, empty numbers as 0. */
export function formBody(v: BanquetFormValues) {
  return {
    ...v,
    expectedPax: v.expectedPax ?? 0,
    guaranteedPax: v.guaranteedPax ?? 0,
    actualPax: v.actualPax,
    seating: v.seating || null,
    platePrice: v.platePrice ?? 0,
    foodGst: v.foodGst ?? 0,
    hallRent: v.hallRent ?? 0,
    hallGst: v.hallGst ?? 0,
    discount: v.discount ?? 0,
    followUpOn: v.followUpOn || null,
  };
}

/**
 * The function form, for a new function and for changing one. A new function can also get extra items
 * (decoration, DJ…) and an advance straight away; on an existing one those are added from its page.
 */
export function BanquetForm({
  initial,
  existing,
  onSubmit,
  submitting,
}: {
  initial: Partial<BanquetFormValues>;
  existing?: BanquetDTO;
  onSubmit: (body: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const { settings, isAdmin } = useApp();
  const [setup, setSetup] = useState<BanquetSetup | null>(null);
  const [v, setV] = useState<BanquetFormValues | null>(null);
  const [rentTouched, setRentTouched] = useState(!!existing);
  const [clashes, setClashes] = useState<Record<string, HallClash[]>>({});
  const [items, setItems] = useState<DraftItem[]>([]);
  const [status, setStatus] = useState<"enquiry" | "tentative" | "confirmed">("confirmed");
  const [advance, setAdvance] = useState<number | null>(null);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("");

  useEffect(() => {
    api<BanquetSetup>("/api/banquets/setup").then((s) => {
      setSetup(s);
      const firstHall = s.halls.find((h) => h.active);
      const hall = s.halls.find((h) => h.id === initial.hallId) ?? firstHall;
      setV({
        customerName: "",
        phone: "",
        email: "",
        company: "",
        gstin: "",
        address: "",
        eventType: "wedding",
        eventName: "",
        hallId: hall?.id ?? "",
        eventDate: settings.today,
        session: "dinner",
        startTime: SESSION_TIMES.dinner[0],
        endTime: SESSION_TIMES.dinner[1],
        expectedPax: null,
        guaranteedPax: null,
        actualPax: null,
        seating: "",
        menuName: "",
        foodType: "veg",
        menuItems: "",
        platePrice: null,
        foodGst: s.defaults.foodGst,
        hallRent: hall?.rent ?? 0,
        hallGst: s.defaults.hallGst,
        discount: 0,
        requirements: "",
        notes: "",
        followUpOn: "",
        ...initial,
      });
    });
    // The form is filled once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which halls are already taken at this date and time.
  const slotKey = v ? `${v.eventDate}|${v.startTime}|${v.endTime}` : "";
  useEffect(() => {
    if (!v || !v.eventDate || !v.startTime || !v.endTime) return;
    let current = true;
    const t = setTimeout(() => {
      api<Array<{ hallId: string; clashes: HallClash[] }>>(
        `/api/banquets/availability?date=${v.eventDate}&start=${v.startTime}&end=${v.endTime}${existing ? `&exceptId=${existing.id}` : ""}`
      )
        .then((r) => current && setClashes(Object.fromEntries(r.map((x) => [x.hallId, x.clashes]))))
        .catch(() => current && setClashes({}));
    }, 250);
    return () => {
      current = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, existing?.id]);

  const bill = useMemo(() => {
    if (!v) return null;
    return banquetBill({
      status: existing?.status,
      expectedPax: v.expectedPax ?? 0,
      guaranteedPax: v.guaranteedPax ?? 0,
      actualPax: v.actualPax,
      platePrice: v.platePrice ?? 0,
      foodGst: v.foodGst ?? 0,
      hallRent: v.hallRent ?? 0,
      hallGst: v.hallGst ?? 0,
      discount: v.discount ?? 0,
      items: existing
        ? existing.items
        : items.map((i) => ({ amount: Math.round((i.quantity ?? 0) * (i.unitPrice ?? 0) * 100) / 100, gstRate: i.gstRate ?? 0 })),
      payments: existing?.payments ?? [],
    });
  }, [v, items, existing]);

  if (!setup || !v || !bill) return <Loading />;

  const activeHalls = setup.halls.filter((h) => h.active || h.id === v.hallId);
  if (activeHalls.length === 0) {
    return (
      <Tip tone="warning">
        No halls have been added yet.{" "}
        {isAdmin ? (
          <Link href="/banquets/setup" className="font-semibold underline">
            Add your halls and menus
          </Link>
        ) : (
          "Ask the owner to add the hotel's halls under Banquets → Halls & menus."
        )}
      </Tip>
    );
  }

  const set = <K extends keyof BanquetFormValues>(k: K, value: BanquetFormValues[K]) => setV((p) => (p ? { ...p, [k]: value } : p));
  const hall = setup.halls.find((h) => h.id === v.hallId);
  const hallClash = clashes[v.hallId] ?? [];
  const holds = existing ? ["tentative", "confirmed", "completed"].includes(existing.status) : status !== "enquiry";
  const overCapacity = hall && hall.capacity > 0 && (v.expectedPax ?? 0) > hall.capacity;
  const afterBill = existing?.status === "completed";
  const giveBack = afterBill && bill.balance < -0.5;
  const money = (n: number) => formatCurrency(n);

  function chooseSession(session: string) {
    const [start, end] = SESSION_TIMES[session as keyof typeof SESSION_TIMES] ?? [v!.startTime, v!.endTime];
    setV((p) => (p ? { ...p, session, startTime: start, endTime: end } : p));
  }

  function chooseHall(id: string) {
    const h = setup!.halls.find((x) => x.id === id);
    setV((p) => (p ? { ...p, hallId: id, ...(!rentTouched && h ? { hallRent: h.rent } : {}) } : p));
  }

  function chooseMenu(id: string) {
    const m = setup!.menus.find((x) => x.id === id);
    if (!m) return set("menuName", "");
    setV((p) => (p ? { ...p, menuName: m.name, foodType: m.foodType, platePrice: m.pricePerPlate, menuItems: m.items ?? "" } : p));
  }

  function addItem() {
    setItems((list) => [...list, { key: Date.now(), category: "decoration", description: "", quantity: 1, unitPrice: null, gstRate: setup!.defaults.itemGst }]);
  }

  function changeItem(key: number, patch: Partial<DraftItem>) {
    setItems((list) =>
      list.map((i) => {
        if (i.key !== key) return i;
        const next = { ...i, ...patch };
        // Changing the kind of item sets its usual GST: food and drinks like the food, the rest like services.
        if (patch.category) next.gstRate = FOOD_ITEM_CATEGORIES.includes(patch.category) ? (v!.foodGst ?? setup!.defaults.foodGst) : setup!.defaults.itemGst;
        return next;
      })
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = formBody(v!);
    if (existing) {
      Object.assign(body, { action: "edit", reason: reason || undefined, refundMethod: giveBack ? refundMethod || undefined : undefined });
    } else {
      Object.assign(body, {
        status,
        items: items
          .filter((i) => i.description.trim() && (i.unitPrice ?? 0) > 0)
          .map((i) => ({ category: i.category, description: i.description, quantity: i.quantity ?? 1, unitPrice: i.unitPrice ?? 0, gstRate: i.gstRate ?? 0 })),
        advance: status !== "enquiry" && advance && advance > 0 ? { amount: advance, method, reference: reference || null } : null,
      });
    }
    onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Customer" description="The person or company who books and pays for the function." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={v.customerName} onChange={(e) => set("customerName", e.target.value)} required autoComplete="off" />
            </Field>
            <Field label="Mobile number">
              <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} required inputMode="tel" autoComplete="off" />
            </Field>
            <Field label="Company" optional hint="For a company function; the bill is made out to it.">
              <Input value={v.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="GSTIN" optional hint="For a company that claims GST back.">
              <Input value={v.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} />
            </Field>
            <Field label="Email" optional>
              <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Address" optional hint="Printed on the bill.">
              <Input value={v.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Function" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind of function">
              <Select value={v.eventType} onChange={(e) => set("eventType", e.target.value)}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name of the function" optional hint="For example “Shah–Mehta wedding reception”.">
              <Input value={v.eventName} onChange={(e) => set("eventName", e.target.value)} />
            </Field>
            <Field label="Date">
              <Input type="date" value={v.eventDate} onChange={(e) => set("eventDate", e.target.value)} required />
            </Field>
            <Field label="Session">
              <Select value={v.session} onChange={(e) => chooseSession(e.target.value)}>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From">
              <Input type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} required />
            </Field>
            <Field label="To" hint={v.endTime <= v.startTime ? "Ends after midnight, on the next day." : undefined}>
              <Input type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} required />
            </Field>
          </CardContent>
          <CardContent className="border-t border-slate-100">
            <p className="mb-2 text-sm font-semibold text-slate-700">Hall</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeHalls.map((h) => {
                const busy = clashes[h.id] ?? [];
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => chooseHall(h.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      v.hallId === h.id ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{h.name}</span>
                      {busy.length ? (
                        <span className="text-xs font-semibold text-red-700">Booked then</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Free</span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {h.capacity ? `Up to ${h.capacity} guests · ` : ""}rent {money(h.rent)}
                      {!h.active && " · switched off"}
                    </span>
                    {busy.map((c) => (
                      <span key={c.id} className="block text-xs text-red-700">
                        #{c.number} {c.customerName}, {c.startTime}–{c.endTime} ({label(c.status)})
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
            {hallClash.length > 0 &&
              (holds ? (
                <Tip tone="danger">
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  {hall?.name} is already booked at this time. Choose another time or hall. It can stay as an enquiry only.
                </Tip>
              ) : (
                <p className="mt-2 text-sm text-amber-700">An enquiry does not hold the hall, but {hall?.name} is already booked at this time.</p>
              ))}
          </CardContent>
          <CardContent className="grid gap-4 border-t border-slate-100 sm:grid-cols-3">
            <Field label="Guests expected">
              <NumberInput value={v.expectedPax} onChange={(n) => set("expectedPax", n === null ? null : Math.round(n))} required />
            </Field>
            <Field label="Guaranteed plates" optional hint="Charged even if fewer guests come.">
              <NumberInput value={v.guaranteedPax} onChange={(n) => set("guaranteedPax", n === null ? null : Math.round(n))} />
            </Field>
            <Field label="Seating" optional>
              <Select value={v.seating} onChange={(e) => set("seating", e.target.value)}>
                <option value="">Not decided</option>
                {SEATING_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </Select>
            </Field>
            {existing && ["confirmed", "completed"].includes(existing.status) && (
              <Field label="Plates served" optional hint="After the function: the plates actually served.">
                <NumberInput value={v.actualPax} onChange={(n) => set("actualPax", n === null ? null : Math.round(n))} />
              </Field>
            )}
            {overCapacity && <p className="text-sm text-amber-700 sm:col-span-3">{hall?.name} holds up to {hall?.capacity} guests.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Food" description="One menu at a price per plate. Add other plates (for example non-veg) as extra items." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Menu" optional hint={setup.menus.length === 0 ? "Menus are added under Halls & menus." : "Fills in the price and dishes; you can still change them."}>
              <Select value={setup.menus.find((m) => m.name === v.menuName)?.id ?? ""} onChange={(e) => chooseMenu(e.target.value)}>
                <option value="">{v.menuName && !setup.menus.some((m) => m.name === v.menuName) ? v.menuName : "Choose a menu"}</option>
                {setup.menus
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({label(m.foodType)}) · {money(m.pricePerPlate)} a plate
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Veg / non-veg">
              <Select value={v.foodType} onChange={(e) => set("foodType", e.target.value)}>
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price per plate" hint="0 if the customer brings their own food or only rents the hall.">
              <NumberInput value={v.platePrice} onChange={(n) => set("platePrice", n)} />
            </Field>
            <Field label="GST on food %">
              <NumberInput value={v.foodGst} onChange={(n) => set("foodGst", n)} />
            </Field>
            <Field label="Dishes" optional hint="One per line. Printed on the function sheet for the kitchen." className="sm:col-span-2">
              <Textarea rows={4} value={v.menuItems} onChange={(e) => set("menuItems", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Hall rent, extras and discount" />
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Hall rent" hint={hall ? `Usual rent for ${hall.name}: ${money(hall.rent)}` : undefined}>
              <NumberInput
                value={v.hallRent}
                onChange={(n) => {
                  setRentTouched(true);
                  set("hallRent", n);
                }}
              />
            </Field>
            <Field label="GST on hall rent %">
              <NumberInput value={v.hallGst} onChange={(n) => set("hallGst", n)} />
            </Field>
            <Field label="Discount" optional hint="On the whole bill, before GST.">
              <NumberInput value={v.discount} onChange={(n) => set("discount", n)} />
            </Field>
          </CardContent>
          {!existing && (
            <CardContent className="border-t border-slate-100">
              <p className="mb-2 text-sm font-semibold text-slate-700">Extra items</p>
              {items.length === 0 && <p className="mb-2 text-sm text-slate-500">Decoration, DJ, extra plates, drinks… They can also be added later.</p>}
              <div className="space-y-3">
                {items.map((i, n) => (
                  <div key={i.key} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-12">
                    <Select aria-label={`Item ${n + 1}: kind`} className="col-span-2 sm:col-span-3" value={i.category} onChange={(e) => changeItem(i.key, { category: e.target.value })}>
                      {BANQUET_ITEM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {label(c)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label={`Item ${n + 1}: what`}
                      className="col-span-2 sm:col-span-3"
                      placeholder="What (e.g. stage decoration)"
                      value={i.description}
                      onChange={(e) => changeItem(i.key, { description: e.target.value })}
                    />
                    <NumberInput aria-label={`Item ${n + 1}: quantity`} className="sm:col-span-1" value={i.quantity} onChange={(q) => changeItem(i.key, { quantity: q })} />
                    <NumberInput aria-label={`Item ${n + 1}: price`} className="sm:col-span-2" placeholder="Price" value={i.unitPrice} onChange={(p) => changeItem(i.key, { unitPrice: p })} />
                    <NumberInput aria-label={`Item ${n + 1}: GST %`} className="sm:col-span-2" value={i.gstRate} onChange={(g) => changeItem(i.key, { gstRate: g })} />
                    <Button variant="ghost" size="sm" aria-label={`Remove item ${n + 1}`} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
              {items.length > 0 && <p className="mt-2 text-xs text-slate-500">Each line: kind, what, quantity, price, GST %.</p>}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader title="For the staff" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Requirements" optional hint="Decoration, stage, DJ, flowers, timings… Printed on the function sheet." className="sm:col-span-2">
              <Textarea rows={3} value={v.requirements} onChange={(e) => set("requirements", e.target.value)} />
            </Field>
            <Field label="Notes" optional>
              <Textarea rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label="Follow up on" optional hint="Enquiry: when to call back. On hold: hold the hall until.">
              <Input type="date" value={v.followUpOn} onChange={(e) => set("followUpOn", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="lg:sticky lg:top-4">
          <CardHeader title="Bill" description={`${bill.billedPax} plate(s) billed`} />
          <CardContent>
            <Row label={`Food: ${bill.billedPax} × ${money(v.platePrice ?? 0)}`}>{money(bill.food)}</Row>
            <Row label="Hall rent">{money(bill.hall)}</Row>
            {bill.extras > 0 && <Row label="Extra items">{money(bill.extras)}</Row>}
            {bill.discount > 0 && <Row label="Discount">− {money(bill.discount)}</Row>}
            {bill.taxLines
              .filter((l) => l.tax > 0)
              .map((l) => (
                <Row key={l.rate} label={`GST ${l.rate}% on ${money(l.taxable)}`}>
                  {money(l.tax)}
                </Row>
              ))}
            <Row label="Total" strong>
              {money(bill.total)}
            </Row>
            {existing && (
              <>
                <Row label="Paid">{money(bill.netPaid)}</Row>
                <Row label={bill.balance >= 0 ? "Still to pay" : "Paid extra"} strong>
                  {money(Math.abs(bill.balance))}
                </Row>
              </>
            )}
          </CardContent>

          {!existing && (
            <CardContent className="space-y-3 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Save as</p>
              <div className="grid gap-2">
                {(
                  [
                    ["confirmed", "Confirmed", "The customer has agreed. Holds the hall."],
                    ["tentative", "On hold (tentative)", "Hold the hall for now, until the date under Follow up."],
                    ["enquiry", "Enquiry", "Only a quote. Does not hold the hall."],
                  ] as const
                ).map(([value, title, help]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={cn(
                      "rounded-xl border p-3 text-left",
                      status === value ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {status === value && <CheckCircle2 className="h-4 w-4 text-primary-600" />}
                      {title}
                    </span>
                    <span className="block text-xs text-slate-500">{help}</span>
                  </button>
                ))}
              </div>
              {status !== "enquiry" && (
                <>
                  <Field label="Advance received" optional>
                    <NumberInput value={advance} onChange={setAdvance} />
                  </Field>
                  {(advance ?? 0) > 0 && (
                    <>
                      <MethodPicker value={method} onChange={setMethod} methods={PAYMENT_METHODS} />
                      <Field label="Reference" optional hint="UPI / cheque / transaction number.">
                        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                      </Field>
                    </>
                  )}
                </>
              )}
            </CardContent>
          )}

          {existing && (
            <CardContent className="space-y-3 border-t border-slate-100">
              <Field label="Reason for the change" optional>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 20 more guests" />
              </Field>
              {giveBack && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">The customer paid {money(-bill.balance)} more than the new total. How was it given back?</p>
                  <MethodPicker value={refundMethod} onChange={setRefundMethod} methods={PAYMENT_METHODS} />
                </div>
              )}
            </CardContent>
          )}

          <CardContent className="border-t border-slate-100">
            <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={(giveBack && !refundMethod) || (holds && hallClash.length > 0)}>
              {existing ? "Save changes" : status === "enquiry" ? "Save enquiry" : "Book the function"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
