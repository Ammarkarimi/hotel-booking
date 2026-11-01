"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, IndianRupee } from "lucide-react";
import { Button, Field, Input, Modal, NumberInput, Row, Select, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { diffDays } from "@/lib/dates";
import { formatCurrency, formatDate, GUEST_PAYMENT_METHODS, label } from "@/lib/utils";
import type { BookingDTO } from "@/lib/types";

type MinimalBooking = Pick<BookingDTO, "id" | "number" | "guestName" | "status" | "checkInDate" | "checkOutDate" | "folio"> & {
  room: { roomNumber: string; housekeeping?: string };
  guest?: { documents?: unknown[] };
  adults?: number;
  idChecks?: { person: string | null }[];
};

export function MethodPicker({
  value,
  onChange,
  methods = GUEST_PAYMENT_METHODS,
}: {
  value: string;
  onChange: (v: string) => void;
  methods?: readonly string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={
            "rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
            (value === m ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
          }
        >
          {label(m)}
        </button>
      ))}
    </div>
  );
}

export function PaymentDialog({
  booking,
  open,
  onClose,
  onDone,
  refund,
}: {
  booking: MinimalBooking | null;
  open: boolean;
  onClose: () => void;
  onDone: (b: BookingDTO) => void;
  refund?: boolean;
}) {
  const { toast } = useApp();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    const due = refund ? Math.max(0, -booking.folio.balance) : Math.max(0, booking.folio.balance);
    setAmount(due > 0 ? String(Math.round(due * 100) / 100) : "");
    setMethod(refund ? "cash" : "upi");
    setReference("");
  }, [open, booking, refund]);

  if (!booking) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setSaving(true);
    try {
      const updated = await api<BookingDTO>("/api/payments", {
        body: { bookingId: booking.id, amount: Number(amount), method, reference, ...(refund && { type: "refund" }) },
      });
      toast(refund ? `Refund of ${formatCurrency(Number(amount))} recorded` : `${formatCurrency(Number(amount))} received. Thank you!`);
      onDone(updated);
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
      title={refund ? "Give money back (refund)" : "Take payment"}
      description={`${booking.guestName} · Room ${booking.room.roomNumber} · Booking #${booking.number}`}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <Row label="Total bill">{formatCurrency(booking.folio.grandTotal)}</Row>
          <Row label="Already paid">{formatCurrency(booking.folio.netPaid)}</Row>
          <Row label={booking.folio.balance >= 0 ? "Still to pay" : "Paid extra"} strong>
            <span className={booking.folio.balance > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(Math.abs(booking.folio.balance))}</span>
          </Row>
        </div>
        <Field label="Amount" hint={refund ? "How much money are you giving back?" : "How much is the guest paying now?"}>
          <div className="relative">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10 text-lg font-semibold"
            />
          </div>
        </Field>
        <Field label="How was it paid?">
          <MethodPicker value={method} onChange={setMethod} />
        </Field>
        {method !== "cash" && (
          <Field label="Reference / transaction ID" optional hint="UPI ref, card slip number or bank reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={refund ? "warning" : "success"} loading={saving} disabled={!Number(amount)}>
            {refund ? "Record refund" : "Save payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CheckOutDialog({
  booking,
  open,
  onClose,
  onDone,
}: {
  booking: MinimalBooking | null;
  open: boolean;
  onClose: () => void;
  onDone: (b: BookingDTO) => void;
}) {
  const { toast } = useApp();
  const [fresh, setFresh] = useState<BookingDTO | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [useBookedDates, setUseBookedDates] = useState(false);
  // GST % chosen here; null until changed, so the booking's own rate is used.
  const [gst, setGst] = useState<{ value: number | null } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    setFresh(null);
    setGst(null);
    setUseBookedDates(false);
    setMethod("upi");
  }, [open, booking]);

  useEffect(() => {
    if (!open || !booking) return;
    let current = true;
    const rate = gst ? `&gstRate=${gst.value ?? "default"}` : "";
    api<BookingDTO>(`/api/bookings/${booking.id}?checkout=1${rate}`)
      .then((b) => current && setFresh(b))
      .catch((e) => toast((e as Error).message, "error"));
    return () => {
      current = false;
    };
  }, [open, booking, toast, gst]);

  // The server works out the bill both ways, so this screen shows exactly what will be charged.
  const preview = fresh?.checkout;
  const f = preview ? (useBookedDates ? preview.booked : preview.stayed) : null;
  const bookedOut = fresh?.checkOutDate ?? booking?.checkOutDate ?? "";
  const leavingEarly = !!preview && preview.today < bookedOut;
  const stayedLonger = !!preview && preview.today > bookedOut;
  const extraNights = preview ? preview.stayed.nightCount - preview.booked.nightCount : 0;
  const balance = f?.balance ?? 0;

  useEffect(() => {
    if (f) setAmount(balance > 0 ? String(balance) : "");
  }, [f, balance]);

  if (!booking) return null;
  const pay = Number(amount) || 0;
  const remaining = Math.round((balance - pay) * 100) / 100;

  async function confirm() {
    if (!booking) return;
    setSaving(true);
    try {
      const updated = await api<BookingDTO>(`/api/bookings/${booking.id}`, {
        body: {
          action: "check_out",
          useBookedDates,
          ...(gst && { gstRate: gst.value }),
          ...(pay > 0 && { payment: { amount: pay, method } }),
        },
      });
      toast(updated.message || "Guest checked out");
      onDone(updated);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Check out ${booking.guestName}`}
      description={`Room ${booking.room.roomNumber} · Booking #${booking.number}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button variant="primary" onClick={confirm} loading={saving} disabled={!f}>
            {pay > 0 ? `Take ${formatCurrency(pay)} & check out` : "Check out"}
          </Button>
        </>
      }
    >
      {!f ? (
        <p className="py-6 text-center text-slate-500">Preparing the bill...</p>
      ) : (
        <div className="space-y-4">
          {leavingEarly && (
            <div className="space-y-2">
              <Tip tone="warning">
                The guest was booked until <b>{formatDate(bookedOut)}</b> but is leaving today.
              </Tip>
              <Toggle
                checked={useBookedDates}
                onChange={setUseBookedDates}
                label="Charge for all booked nights"
                description="Leave this off to charge only for the nights actually stayed."
              />
            </div>
          )}
          {stayedLonger && (
            <div className="space-y-2">
              <Tip tone="warning">
                The guest was booked until <b>{formatDate(bookedOut)}</b> and was not checked out, so {extraNights} extra night{extraNights === 1 ? " is" : "s are"} added to
                the bill.
              </Tip>
              <Toggle
                checked={useBookedDates}
                onChange={setUseBookedDates}
                label={`Charge only until ${formatDate(bookedOut)}`}
                description="Turn this on if the guest really left on time and was only checked out late in the app."
              />
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3">
            <Row label={`Room (${f.nightCount} night${f.nightCount === 1 ? "" : "s"}, incl. ${f.roomTaxRate}% GST)`}>{formatCurrency(f.roomAfterDiscount + f.roomTax)}</Row>
            {f.extrasTotal > 0 && <Row label="Extras (food, laundry...)">{formatCurrency(f.extrasTotal + f.extrasTax)}</Row>}
            <Row label="Total bill (incl. tax)" strong>
              {formatCurrency(f.grandTotal)}
            </Row>
            <Row label="Already paid">{formatCurrency(f.netPaid)}</Row>
            <Row label={balance >= 0 ? "Still to pay" : "Paid extra (refund due)"} strong>
              <span className={balance > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(Math.abs(balance))}</span>
            </Row>
          </div>

          <Field label="GST on the room" hint="The default comes from Settings. Change it only if this bill needs a different rate.">
            <GstPicker value={gst ? gst.value : (fresh?.gstRate ?? null)} defaultRate={f.defaultRoomTaxRate} onChange={(v) => setGst({ value: v })} />
          </Field>

          {balance > 0 && (
            <>
              <Field label="Payment now" hint="Change the amount if the guest pays only part, or clear it if they will pay later.">
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
              </Field>
              {pay > 0 && (
                <Field label="How is the guest paying?">
                  <MethodPicker value={method} onChange={setMethod} />
                </Field>
              )}
              {remaining > 0.5 && (
                <Tip tone="danger">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> The guest will still owe {formatCurrency(remaining)} after checking out.
                  </span>
                </Tip>
              )}
            </>
          )}
          {balance < -0.5 && <Tip tone="info">The guest paid more than the bill. After check-out, open the booking and use “Refund” to give money back.</Tip>}
          <p className="text-xs text-slate-500">The room will be marked “Needs cleaning” automatically and the final invoice will be created.</p>
        </div>
      )}
    </Modal>
  );
}

const GST_CHOICES = [0, 5, 12, 18];

/** GST % on the room for one booking: the default from Settings or another rate. null means the default. */
export function GstPicker({ value, defaultRate, onChange }: { value: number | null; defaultRate: number; onChange: (v: number | null) => void }) {
  const choices = [...new Set([...GST_CHOICES, defaultRate])].sort((a, b) => a - b);
  const current = value ?? defaultRate;
  const [other, setOther] = useState(!choices.includes(current));
  const chip = (selected: boolean) =>
    "rounded-xl border px-3 py-2 text-sm font-semibold transition " +
    (selected ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {choices.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setOther(false);
              onChange(r === defaultRate ? null : r);
            }}
            className={chip(!other && current === r)}
          >
            {r}%{r === defaultRate && <span className="ml-1 text-xs font-normal">(default)</span>}
          </button>
        ))}
        <button type="button" onClick={() => setOther(true)} className={chip(other)}>
          Other
        </button>
      </div>
      {other && (
        <NumberInput
          value={value}
          onChange={(v) => onChange(v === null ? null : Math.min(v, 40))}
          placeholder={`e.g. ${defaultRate}`}
          aria-label="GST %"
          className="w-40"
          autoFocus
        />
      )}
    </div>
  );
}

/** Hook bundling all booking actions with friendly confirmations. */
export function useBookingActions(onChanged: (b?: BookingDTO) => void) {
  const { toast, confirm, settings } = useApp();
  const [paymentFor, setPaymentFor] = useState<MinimalBooking | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<MinimalBooking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(b: MinimalBooking, action: string, extra: Record<string, unknown> = {}) {
    setBusy(b.id);
    try {
      const updated = await api<BookingDTO>(`/api/bookings/${b.id}`, { body: { action, ...extra } });
      toast(updated.message || "Done");
      onChanged(updated);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function checkIn(b: MinimalBooking) {
    const warnings: string[] = [];
    if (b.room.housekeeping && b.room.housekeeping !== "clean") warnings.push(`Room ${b.room.roomNumber} is marked “${label(b.room.housekeeping)}”.`);
    if (b.idChecks && b.adults) {
      const checked = new Set(b.idChecks.map((c) => c.person ?? "")).size;
      if (checked < b.adults)
        warnings.push(`ID checked for ${checked} of ${b.adults} adult${b.adults > 1 ? "s" : ""}. Scan each Aadhaar QR (or check another ID) under “ID check” on the booking.`);
    } else if (b.guest?.documents && b.guest.documents.length === 0) warnings.push("No ID proof uploaded yet — remember to collect it.");
    const earlyNights = diffDays(settings.today, b.checkInDate);
    if (earlyNights > 0) {
      warnings.push(
        `This booking starts on ${formatDate(b.checkInDate)}. Checking in today adds ${earlyNights} extra night${earlyNights > 1 ? "s" : ""} to the bill.`
      );
    }
    const ok = await confirm({
      title: `Check in ${b.guestName}?`,
      message: (
        <div className="space-y-2">
          <p>
            Room <b>{b.room.roomNumber}</b>, leaving on <b>{formatDate(b.checkOutDate)}</b>.
          </p>
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </p>
          ))}
        </div>
      ),
      confirmText: "Yes, check in",
    });
    if (ok) await run(b, "check_in");
  }

  async function cancel(b: MinimalBooking) {
    const ok = await confirm({
      title: `Cancel booking #${b.number}?`,
      message: (
        <>
          {b.guestName}, Room {b.room.roomNumber}, {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}.
          {b.folio.netPaid > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              The guest paid {formatCurrency(b.folio.netPaid)}. If you return money, record it with “Refund” afterwards.
            </p>
          )}
        </>
      ),
      askReason: "Reason (optional)",
      confirmText: "Yes, cancel booking",
      danger: true,
    });
    if (ok) await run(b, "cancel", { reason: ok.reason });
  }

  async function noShow(b: MinimalBooking) {
    const ok = await confirm({
      title: `Mark ${b.guestName} as “did not come”?`,
      message: "Use this when a guest never arrived. The room becomes free again.",
      confirmText: "Yes, mark no-show",
      danger: true,
    });
    if (ok) await run(b, "no_show");
  }

  async function undoCheckIn(b: MinimalBooking) {
    const ok = await confirm({ title: "Undo check-in?", message: "Use this only if you checked in the wrong guest by mistake.", confirmText: "Yes, undo" });
    if (ok) await run(b, "undo_check_in");
  }

  const dialogs = (
    <>
      <PaymentDialog booking={paymentFor} open={!!paymentFor} onClose={() => setPaymentFor(null)} onDone={(b) => onChanged(b)} />
      <CheckOutDialog booking={checkoutFor} open={!!checkoutFor} onClose={() => setCheckoutFor(null)} onDone={(b) => onChanged(b)} />
    </>
  );

  return {
    busy,
    checkIn,
    checkOut: (b: MinimalBooking) => setCheckoutFor(b),
    takePayment: (b: MinimalBooking) => setPaymentFor(b),
    cancel,
    noShow,
    undoCheckIn,
    dialogs,
  };
}
