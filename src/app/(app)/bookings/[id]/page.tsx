"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  DoorOpen,
  FileText,
  LogIn,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  Undo2,
  UserPlus,
  UserX,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CountInput, EmptyState, Field, Input, Loading, Modal, Row, Select, StatusBadge, Textarea, Tip } from "@/components/ui";
import { GstPicker, PaymentDialog, useBookingActions } from "@/components/booking-actions";
import { IdCheckCard } from "@/components/id-checks";
import { useGuestMessage } from "@/components/guest-message";
import { messageKindFor } from "@/lib/messages";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays, diffDays } from "@/lib/dates";
import { isOtaSource, netAfterDeductions } from "@/lib/payouts";
import { paymentState } from "@/lib/pricing";
import { BOOKING_SOURCES, CHARGE_CATEGORIES, cn, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { BookingDetailDTO, RoomDTO } from "@/lib/types";

function AddChargeDialog({ booking, open, onClose, onDone }: { booking: BookingDetailDTO; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [category, setCategory] = useState("food");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("food");
      setDescription("");
      setQuantity("1");
      setUnitPrice("");
    }
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/bookings/${booking.id}/charges`, { body: { category, description, quantity: Number(quantity), unitPrice: Number(unitPrice) } });
      toast("Added to the guest's bill");
      onDone();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return (
    <Modal open={open} onClose={onClose} title="Add to guest's bill" description="Food, laundry, minibar, taxi or anything else the guest should pay for.">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHARGE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold",
                category === c ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200" : "border-slate-200 hover:bg-slate-50"
              )}
            >
              {label(c)}
            </button>
          ))}
        </div>
        <Field label="Description" optional hint="e.g. Dinner — 2 thali">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={label(category)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity">
            <Input type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
          <Field label="Price each">
            <Input type="number" min="0.01" step="any" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required autoFocus />
          </Field>
        </div>
        {total > 0 && (
          <p className="text-right text-lg font-bold">
            Total: {formatCurrency(total)} <span className="text-sm font-normal text-slate-500">+ tax</span>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!total}>
            Add to bill
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Journey and the other adults' names, as the Change booking form edits them. */
function travelOf(b: BookingDetailDTO) {
  return {
    comingFrom: b.comingFrom ?? "",
    goingTo: b.goingTo ?? "",
    vehicleNumber: b.vehicleNumber ?? "",
    companions: b.companions.map((c) => ({ name: c.name, phone: c.phone ?? "", aadhaarAtDesk: !!c.aadhaarAtDesk, was: c.name })),
  };
}

function EditBookingDialog({ booking, open, onClose, onDone }: { booking: BookingDetailDTO; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast, settings } = useApp();
  const [form, setForm] = useState({
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    roomId: booking.room.id,
    ratePerNight: String(booking.ratePerNight),
    discount: String(booking.discount || ""),
    gstRate: booking.gstRate,
    adults: booking.adults,
    children: booking.children,
    source: booking.source,
    notes: booking.notes || "",
    otaReference: booking.otaReference || "",
    ...travelOf(booking),
  });
  const [rooms, setRooms] = useState<RoomDTO[] | null>(null);
  const [saving, setSaving] = useState(false);
  const started = booking.status === "checked_in";

  useEffect(() => {
    if (!open) return;
    setForm({
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomId: booking.room.id,
      ratePerNight: String(booking.ratePerNight),
      discount: String(booking.discount || ""),
      gstRate: booking.gstRate,
      adults: booking.adults,
      children: booking.children,
      source: booking.source,
      notes: booking.notes || "",
      otaReference: booking.otaReference || "",
      ...travelOf(booking),
    });
  }, [open, booking]);

  useEffect(() => {
    if (!open || form.checkOutDate <= form.checkInDate) return;
    setRooms(null);
    api<RoomDTO[]>(`/api/availability?checkIn=${form.checkInDate}&checkOut=${form.checkOutDate}&excludeBookingId=${booking.id}`)
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [open, form.checkInDate, form.checkOutDate, booking.id]);

  const roomFree = !rooms || rooms.some((r) => r.id === form.roomId);
  const nights = diffDays(form.checkInDate, form.checkOutDate);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        checkOutDate: form.checkOutDate,
        roomId: form.roomId,
        discount: Number(form.discount) || 0,
        adults: form.adults,
        children: form.children,
        source: form.source,
        notes: form.notes,
        otaReference: form.otaReference,
        comingFrom: form.comingFrom,
        goingTo: form.goingTo,
        vehicleNumber: form.vehicleNumber,
        companions: form.companions.map((c) => ({ ...c, name: c.name.trim() })),
      };
      if (!started) body.checkInDate = form.checkInDate;
      if (Number(form.ratePerNight) !== booking.ratePerNight) body.ratePerNight = Number(form.ratePerNight);
      if (form.gstRate !== booking.gstRate) body.gstRate = form.gstRate;
      await api(`/api/bookings/${booking.id}`, { method: "PATCH", body });
      toast("Booking updated");
      onDone();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change booking" description="Change dates, extend the stay, move to another room, change the price, or correct the travel details and names." size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Arrival date" hint={started ? "The guest has already arrived." : undefined}>
            <Input type="date" value={form.checkInDate} disabled={started} min={started ? undefined : settings.today} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
          </Field>
          <Field label="Leaving date" hint="To extend the stay, choose a later date.">
            <Input type="date" value={form.checkOutDate} min={addDays(form.checkInDate, 1)} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
          </Field>
        </div>
        {started && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 7].map((n) => (
              <Button key={n} size="sm" variant="outline" onClick={() => setForm({ ...form, checkOutDate: addDays(booking.checkOutDate, n) })}>
                Extend +{n} night{n > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
        )}
        {nights < 1 && <Tip tone="danger">The leaving date must be after the arrival date.</Tip>}
        <Field label={started ? "Room (move the guest)" : "Room"}>
          <Select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
            {!rooms?.some((r) => r.id === booking.room.id) && (
              <option value={booking.room.id}>
                Room {booking.room.roomNumber} (current{rooms ? " — NOT free for new dates" : ""})
              </option>
            )}
            {(rooms ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.roomNumber} — {label(r.type)} · {formatCurrency(r.pricePerNight)}/night{r.id === booking.room.id ? " (current)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {!roomFree && <Tip tone="danger">This room is not free for the new dates. Please choose another room.</Tip>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price per night" hint={booking.fixedRate ? "Special price (no weekend/season changes)" : "Normal price"}>
            <Input type="number" min={0} inputMode="decimal" required value={form.ratePerNight} onChange={(e) => setForm({ ...form, ratePerNight: e.target.value })} />
          </Field>
          <Field label="Discount (amount)">
            <Input type="number" min={0} inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" />
          </Field>
          <Field label="GST on the room" hint="The default comes from Settings." className="sm:col-span-2">
            <GstPicker value={form.gstRate} defaultRate={booking.folio.defaultRoomTaxRate} onChange={(gstRate) => setForm({ ...form, gstRate })} />
          </Field>
          <Field label="Adults">
            <CountInput min={1} max={20} value={form.adults} onChange={(adults) => setForm({ ...form, adults })} aria-label="adults" />
          </Field>
          <Field label="Children">
            <CountInput min={0} max={20} value={form.children} onChange={(children) => setForm({ ...form, children })} aria-label="children" />
          </Field>
        </div>
        <Field label="Booking came from">
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {BOOKING_SOURCES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </Select>
        </Field>
        {(isOtaSource(form.source) || form.otaReference) && (
          <Field label={`${label(form.source)} booking ID`} optional hint="Their booking number, to match their payment statement.">
            <Input value={form.otaReference} maxLength={60} onChange={(e) => setForm({ ...form, otaReference: e.target.value })} />
          </Field>
        )}
        <Field label="Notes" optional>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </Field>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Travel and other adults</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Coming from" optional>
              <Input maxLength={80} value={form.comingFrom} onChange={(e) => setForm({ ...form, comingFrom: e.target.value })} />
            </Field>
            <Field label="Going to next" optional>
              <Input maxLength={80} value={form.goingTo} onChange={(e) => setForm({ ...form, goingTo: e.target.value })} />
            </Field>
            <Field label="Vehicle number" optional>
              <Input maxLength={20} value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          {form.companions.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={`Adult ${i + 2}: name`} className="min-w-0 flex-1">
                <Input
                  required
                  maxLength={80}
                  value={c.name}
                  onChange={(e) => setForm({ ...form, companions: form.companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                />
              </Field>
              <Button
                variant="ghost"
                aria-label={`Take ${c.name || `adult ${i + 2}`} off the booking`}
                onClick={() => setForm({ ...form, companions: form.companions.filter((_, j) => j !== i) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {form.companions.length < form.adults - 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setForm({ ...form, companions: [...form.companions, { name: "", phone: "", aadhaarAtDesk: false, was: "" }] })}
            >
              <UserPlus className="h-4 w-4" /> Add the name of adult {form.companions.length + 2}
            </Button>
          )}
          {form.companions.length > form.adults - 1 && (
            <Tip tone="danger">There are more names than adults. Take a name off, or raise the number of adults.</Tip>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={nights < 1 || !roomFree || form.companions.length > form.adults - 1}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}


/** What the booking site deducts and pays the hotel. The bill and invoice stay on the gross amount. */
function PayoutDialog({ booking, open, onClose, onDone }: { booking: BookingDetailDTO; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast, settings } = useApp();
  const gross = booking.folio.grandTotal;
  const blank = (n: number) => (n ? String(n) : "");
  const initial = () => ({
    otaReference: booking.otaReference ?? "",
    commission: blank(booking.payoutCommission),
    commissionGst: blank(booking.payoutCommissionGst),
    tcs: blank(booking.payoutTcs),
    tds: blank(booking.payoutTds),
    net: booking.payoutAmount === null ? "" : String(booking.payoutAmount),
    received: !!booking.payoutReceivedOn,
    receivedOn: booking.payoutReceivedOn ?? settings.today,
    bankRef: booking.payoutBankRef ?? "",
  });
  const [form, setForm] = useState(initial);
  // Until the owner types the amount, it follows the deductions.
  const [netTyped, setNetTyped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial());
    setNetTyped(booking.payoutAmount !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking]);

  const deductions = { commission: Number(form.commission) || 0, commissionGst: Number(form.commissionGst) || 0, tcs: Number(form.tcs) || 0, tds: Number(form.tds) || 0 };
  const suggested = netAfterDeductions(gross, deductions);
  const anyDeduction = Object.values(deductions).some((v) => v > 0);
  const net = netTyped ? form.net : anyDeduction ? String(suggested) : form.net;
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save(clear = false) {
    setSaving(true);
    try {
      await api(`/api/bookings/${booking.id}/payout`, {
        method: "PUT",
        body: clear
          ? { otaReference: form.otaReference, payoutAmount: null }
          : {
              otaReference: form.otaReference,
              payoutAmount: net === "" ? null : Number(net),
              payoutCommission: deductions.commission,
              payoutCommissionGst: deductions.commissionGst,
              payoutTcs: deductions.tcs,
              payoutTds: deductions.tds,
              payoutReceivedOn: form.received ? form.receivedOn : null,
              payoutBankRef: form.received ? form.bankRef : "",
            },
      });
      toast(clear ? "Payout cleared" : "Payout saved");
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const money = (key: "commission" | "commissionGst" | "tcs" | "tds", text: string, hint?: string) => (
    <Field label={text} optional hint={hint}>
      <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" value={form[key]} onChange={(e) => update({ [key]: e.target.value })} />
    </Field>
  );

  return (
    <Modal open={open} onClose={onClose} title="Booking site payout" description={`The bill stays at ${formatCurrency(gross)}. Write down what ${label(booking.source)} takes off and pays you.`} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <Field label={`${label(booking.source)} booking ID`} optional hint="Their booking number, to match their payment statement.">
          <Input value={form.otaReference} maxLength={60} onChange={(e) => update({ otaReference: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {money("commission", "Commission")}
          <Field label="GST on commission" optional hint={deductions.commission ? undefined : "Usually 18% of the commission."}>
            <div className="flex gap-2">
              <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" value={form.commissionGst} onChange={(e) => update({ commissionGst: e.target.value })} />
              {deductions.commission > 0 && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => update({ commissionGst: String(Math.round(deductions.commission * 18) / 100) })}>
                  18%
                </Button>
              )}
            </div>
          </Field>
          {money("tcs", "TCS", "Tax collected at source by the site")}
          {money("tds", "TDS", "Tax deducted at source by the site")}
        </div>
        <Field label="Amount the site pays you" hint={anyDeduction && !netTyped ? "Worked out from the deductions. You can change it." : "Leave empty if you don't know it yet."}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={net}
            onChange={(e) => {
              setNetTyped(true);
              update({ net: e.target.value });
            }}
            className="text-lg font-semibold"
          />
        </Field>
        {net !== "" && (
          <div className="rounded-xl bg-slate-50 p-3 text-[15px]">
            <Row label="Bill (gross)">{formatCurrency(gross)}</Row>
            <Row label="Taken off by the site">− {formatCurrency(Math.round((gross - Number(net)) * 100) / 100)}</Row>
            <Row label="Site pays you" strong>
              {formatCurrency(Number(net))}
            </Row>
          </div>
        )}
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-primary-600" checked={form.received} onChange={(e) => update({ received: e.target.checked })} />
          The money has reached our bank
        </label>
        {form.received && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date received">
              <Input type="date" required max={settings.today} value={form.receivedOn} onChange={(e) => update({ receivedOn: e.target.value })} />
            </Field>
            <Field label="Bank reference (UTR)" optional>
              <Input value={form.bankRef} maxLength={60} onChange={(e) => update({ bankRef: e.target.value })} />
            </Field>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {booking.payoutAmount !== null ? (
            <Button variant="ghost" className="text-red-600" onClick={() => save(true)}>
              Clear payout
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save payout
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function PayoutCard({ booking, onEdit }: { booking: BookingDetailDTO; onEdit: () => void }) {
  const p = booking.payout;
  return (
    <Card>
      <CardHeader
        title="Booking site payout"
        description={`What ${label(booking.source)} pays you after its deductions. The bill stays on the full amount.`}
        action={
          <Button size="sm" variant="outline" onClick={onEdit}>
            {p ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {p ? "Change" : "Enter"}
          </Button>
        }
      />
      <CardContent className="text-[15px]">
        {booking.otaReference && <Row label="Their booking ID">{booking.otaReference}</Row>}
        {!p ? (
          <p className="py-2 text-sm text-slate-500">Not entered yet. Add it from the site&apos;s payment statement to see your real earnings.</p>
        ) : (
          <>
            <Row label="Bill (gross)">{formatCurrency(p.gross)}</Row>
            {p.commission > 0 && <Row label="Commission">− {formatCurrency(p.commission)}</Row>}
            {p.commissionGst > 0 && <Row label="GST on commission">− {formatCurrency(p.commissionGst)}</Row>}
            {p.tcs > 0 && <Row label="TCS">− {formatCurrency(p.tcs)}</Row>}
            {p.tds > 0 && <Row label="TDS">− {formatCurrency(p.tds)}</Row>}
            {Math.abs(p.other) > 0.5 && <Row label="Other deductions">− {formatCurrency(p.other)}</Row>}
            <Row label="Site pays you" strong>
              {formatCurrency(p.net)}
            </Row>
            <p className={cn("mt-2 rounded-lg px-3 py-2 text-sm font-semibold", p.received ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
              {p.received ? `Received ${formatDate(booking.payoutReceivedOn!)}${booking.payoutBankRef ? ` · ${booking.payoutBankRef}` : ""}` : "Waiting for the site to pay"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast, confirm, isAdmin, settings: shell } = useApp();
  const guestMessage = useGuestMessage();
  const [b, setB] = useState<BookingDetailDTO | null>(null);
  const [error, setError] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [showNights, setShowNights] = useState(false);

  const load = useCallback(() => {
    api<BookingDetailDTO>(`/api/bookings/${id}`)
      .then(setB)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => load(), [load]);
  const actions = useBookingActions(() => load());

  if (error) return <EmptyState title="Booking not found" description={error} action={<Button onClick={() => router.push("/bookings")}>All bookings</Button>} />;
  if (!b) return <Loading text="Loading booking..." />;

  const f = b.folio;
  const open = b.status === "reserved" || b.status === "checked_in";
  const pState = paymentState(f.grandTotal, f.netPaid);
  const s = b.settings;

  // The message for where the guest is now: confirmation, welcome while staying, thanks after leaving.
  const shareKind = messageKindFor(b.status);
  const shareText = guestMessage(shareKind, b);

  async function removeCharge(chargeId: string, desc: string) {
    const ok = await confirm({ title: "Remove this item from the bill?", message: desc, confirmText: "Yes, remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/bookings/${id}/charges?chargeId=${chargeId}`, { method: "DELETE" });
      toast("Item removed");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removePayment(paymentId: string, amount: number) {
    const ok = await confirm({ title: "Delete this payment?", message: `${formatCurrency(amount)} will be removed from the records. Only do this if it was entered by mistake.`, confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/payments?id=${paymentId}`, { method: "DELETE" });
      toast("Payment deleted");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function deleteBooking() {
    const ok = await confirm({ title: `Delete booking #${b!.number} permanently?`, message: "This cannot be undone. Usually it is better to cancel.", confirmText: "Yes, delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/bookings/${id}`, { method: "DELETE" });
      toast("Booking deleted");
      router.push("/bookings");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bookings" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All bookings
        </Link>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">Booking #{b.number}</h1>
              <StatusBadge status={b.status} className="text-sm" />
              <Badge variant={pState}>{label(pState)}</Badge>
              {b.flags.overstay && <Badge variant="danger">Past leaving date</Badge>}
            </div>
            <p className="mt-1 text-[15px] text-slate-500">
              {b.guestName} · Room {b.room.roomNumber} · {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {b.status === "reserved" && (
              <Button size="lg" variant="success" onClick={() => actions.checkIn(b)} loading={actions.busy === b.id}>
                <LogIn className="h-5 w-5" /> Check in
              </Button>
            )}
            {b.status === "checked_in" && (
              <Button size="lg" onClick={() => actions.checkOut(b)}>
                <DoorOpen className="h-5 w-5" /> Check out
              </Button>
            )}
            {f.balance > 0.5 && b.status !== "cancelled" && b.status !== "no_show" && (
              <Button size="lg" variant={b.status === "checked_out" ? "success" : "outline"} onClick={() => actions.takePayment(b)}>
                <Wallet className="h-5 w-5" /> Take payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {b.guest.blacklisted && <Tip tone="danger">⚠ This guest is marked “Do not allow”. {b.guest.notes}</Tip>}
      {b.flags.lateArrival && <Tip tone="warning">This guest was due on {formatDate(b.checkInDate)} and has not checked in. Check them in, or mark “Did not come”.</Tip>}
      {b.flags.overstay && <Tip tone="warning">This guest was due to leave on {formatDate(b.checkOutDate)}. Extend the stay with “Change booking”, or check them out.</Tip>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Bill"
              description={b.bill ? `Final invoice ${b.bill.invoiceNumber} created ${formatDateTime(b.bill.generatedAt)}` : "Running total. It becomes final when the guest checks out."}
              action={
                open && (
                  <Button size="sm" variant="outline" onClick={() => setChargeOpen(true)}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                )
              }
            />
            <CardContent>
              <Row label={`Room: ${f.nightCount} night${f.nightCount > 1 ? "s" : ""} × ${formatCurrency(b.ratePerNight)}${b.fixedRate ? " (special price)" : ""}`}>
                {formatCurrency(f.roomTotal)}
              </Row>
              {f.nights.some((n) => n.adjustment !== 0) && !b.bill && (
                <button onClick={() => setShowNights((v) => !v)} className="mb-1 text-xs font-semibold text-primary-600 hover:underline">
                  {showNights ? "Hide" : "Show"} price for each night
                </button>
              )}
              {showNights && (
                <div className="mb-2 rounded-lg bg-slate-50 p-2 text-sm">
                  {f.nights.map((n) => (
                    <div key={n.date} className="flex justify-between px-2 py-0.5">
                      <span>
                        {formatDate(n.date)} {n.adjustment !== 0 && <span className="text-xs text-slate-500">({n.adjustment > 0 ? "+" : ""}{n.adjustment}%)</span>}
                      </span>
                      <span>{formatCurrency(n.rate)}</span>
                    </div>
                  ))}
                </div>
              )}
              {f.discount > 0 && <Row label="Discount">− {formatCurrency(f.discount)}</Row>}
              {b.charges.map((c) => (
                <div key={c.id} className="group flex items-center justify-between gap-2 py-1.5 text-[15px]">
                  <span className="text-slate-600">
                    {c.description}
                    {c.quantity !== 1 && ` (${c.quantity} × ${formatCurrency(c.unitPrice)})`}
                    <span className="ml-2 text-xs text-slate-400">{formatDate(c.date)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {formatCurrency(c.amount)}
                    {open && (
                      <button onClick={() => removeCharge(c.id, `${c.description} — ${formatCurrency(c.amount)}`)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>
              ))}
              <Row label={`GST on room (${f.roomTaxRate}%${b.gstRate !== null && f.roomTaxRate !== f.defaultRoomTaxRate ? ", set for this booking" : ""})`}>{formatCurrency(f.roomTax)}</Row>
              {f.extrasTotal > 0 && <Row label={`Tax on extras (${f.extrasTaxRate}%)`}>{formatCurrency(f.extrasTax)}</Row>}
              <div className="my-2 border-t border-slate-200" />
              <Row label="Total" strong>
                {formatCurrency(f.grandTotal)}
              </Row>
              <Row label="Paid">{formatCurrency(f.paid)}</Row>
              {f.refunded > 0 && <Row label="Refunded">− {formatCurrency(f.refunded)}</Row>}
              {!open && b.status !== "checked_out" ? (
                <div className="mt-2 rounded-xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-700">
                  This booking is {label(b.status).toLowerCase()}, so nothing is due.
                  {f.netPaid > 0 && ` The guest paid ${formatCurrency(f.netPaid)} — use “Refund” if you return it.`}
                </div>
              ) : (
              <div className={cn("mt-2 flex items-center justify-between rounded-xl px-4 py-3 text-lg font-bold", f.balance > 0.5 ? "bg-red-50 text-red-700" : f.balance < -0.5 ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700")}>
                <span>{f.balance > 0.5 ? "Still to pay" : f.balance < -0.5 ? "Paid extra — refund due" : "Fully paid"}</span>
                <span>{formatCurrency(Math.abs(f.balance))}</span>
              </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Payments"
              action={
                f.netPaid > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
                    <RotateCcw className="h-4 w-4" /> Refund
                  </Button>
                )
              }
            />
            {b.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-semibold">
                        {label(p.type)} · {label(p.method)}
                        {p.reference && <span className="ml-1 text-sm font-normal text-slate-500">({p.reference})</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(p.paidAt)}
                        {p.receivedBy && ` · by ${p.receivedBy}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-bold", p.type === "refund" ? "text-violet-700" : "text-emerald-700")}>
                        {p.type === "refund" ? "− " : ""}
                        {formatCurrency(p.amount)}
                      </span>
                      {isAdmin && (
                        <button onClick={() => removePayment(p.id, p.amount)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete payment">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Guest" action={<Link href={`/guests/${b.guest.id}`} className="text-sm font-semibold text-primary-600 hover:underline">Open profile</Link>} />
            <CardContent className="space-y-2 text-[15px]">
              <p className="text-lg font-bold">
                {b.guestName} {b.guest.vip && <Badge variant="purple">VIP</Badge>}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <a href={`tel:${b.guest.phone}`} className="text-primary-700 hover:underline">
                  {b.guest.phone}
                </a>
              </p>
              {b.guest.email && <p className="text-slate-600">{b.guest.email}</p>}
              {b.guest.company && <p className="text-slate-600">{b.guest.company}{b.guest.gstin && ` · GSTIN ${b.guest.gstin}`}</p>}
              <p className="text-slate-600">
                {b.guest.idType === "aadhar" ? (
                  <>ID: Aadhaar · checked at the desk (see ID check)</>
                ) : (
                  <>
                    ID: {b.guest.idType ? `${label(b.guest.idType)} ${b.guest.idNumber ?? ""}` : "not entered"} ·{" "}
                    {b.guest.documents.length > 0 ? (
                      <span className="text-emerald-700">{b.guest.documents.length} document(s) uploaded</span>
                    ) : (
                      <Link href={`/guests/${b.guest.id}`} className="font-semibold text-amber-700 hover:underline">
                        Upload ID photo
                      </Link>
                    )}
                  </>
                )}
              </p>
              {(b.companions.length > 0 || b.comingFrom || b.goingTo || b.vehicleNumber) && (
                <div className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {b.companions.length > 0 && (
                    <p>
                      <b>Staying with:</b> {b.companions.map((c) => c.name).join(", ")}
                    </p>
                  )}
                  {(b.comingFrom || b.goingTo) && (
                    <p>
                      <b>Journey:</b> {[b.comingFrom && `from ${b.comingFrom}`, b.goingTo && `going to ${b.goingTo}`].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {b.vehicleNumber && (
                    <p>
                      <b>Vehicle:</b> {b.vehicleNumber}
                    </p>
                  )}
                </div>
              )}
              <a href={whatsappLink(b.guest.phone, shareText)} target="_blank" rel="noopener noreferrer" className="block pt-1">
                <Button variant="success" size="sm" className="w-full">
                  <MessageCircle className="h-4 w-4" />{" "}
                  {shareKind === "checkIn" ? "Send welcome message" : shareKind === "checkOut" ? "Send thank-you message" : "Send booking details"}
                </Button>
              </a>
            </CardContent>
          </Card>

          <IdCheckCard booking={b} onChanged={load} />

          <Card>
            <CardHeader
              title="Stay"
              action={
                open && (
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Change
                  </Button>
                )
              }
            />
            <CardContent className="text-[15px]">
              <Row label="Room">
                {b.room.roomNumber} ({label(b.room.type)})
              </Row>
              <Row label="Arrival">{formatDate(b.checkInDate)}</Row>
              <Row label="Leaving">{formatDate(b.checkOutDate)}</Row>
              <Row label="Nights">{f.nightCount}</Row>
              <Row label="Guests">
                {b.adults} adult{b.adults > 1 ? "s" : ""}
                {b.children > 0 && `, ${b.children} child${b.children > 1 ? "ren" : ""}`}
              </Row>
              <Row label="Came from">{label(b.source)}</Row>
              {b.otaReference && <Row label="Their booking ID">{b.otaReference}</Row>}
              {b.actualCheckIn && <Row label="Checked in">{formatDateTime(b.actualCheckIn)}</Row>}
              {b.actualCheckOut && <Row label="Checked out">{formatDateTime(b.actualCheckOut)}</Row>}
              <Row label="Booked on">{formatDateTime(b.createdAt)}</Row>
              {b.notes && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{b.notes}</p>}
              {b.cancelReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Reason: {b.cancelReason}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Print" />
            <CardContent className="grid gap-2">
              <a href={`/print/invoice/${b.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <Receipt className="h-5 w-5" /> {b.bill ? "Invoice / bill" : "Bill so far (proforma)"}
                </Button>
              </a>
              <a href={`/print/confirmation/${b.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarClock className="h-5 w-5" /> Booking confirmation
                </Button>
              </a>
              <a href={`/print/registration/${b.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-5 w-5" /> Guest registration card
                </Button>
              </a>
            </CardContent>
          </Card>

          {isAdmin && (isOtaSource(b.source) || b.payoutAmount !== null || b.payments.some((p) => p.method === "ota")) && b.status !== "cancelled" && (
            <PayoutCard booking={b} onEdit={() => setPayoutOpen(true)} />
          )}

          {(b.status === "reserved" || b.status === "checked_in" || isAdmin) && (
            <Card>
              <CardHeader title="Other actions" />
              <CardContent className="grid gap-2">
                {b.status === "reserved" && (
                  <>
                    {b.checkInDate <= shell.today && (
                      <Button variant="outline" className="justify-start" onClick={() => actions.noShow(b)}>
                        <UserX className="h-5 w-5" /> Guest did not come
                      </Button>
                    )}
                    <Button variant="outline" className="justify-start text-red-600" onClick={() => actions.cancel(b)}>
                      <XCircle className="h-5 w-5" /> Cancel booking
                    </Button>
                  </>
                )}
                {b.status === "checked_in" && (
                  <Button variant="outline" className="justify-start" onClick={() => actions.undoCheckIn(b)}>
                    <Undo2 className="h-5 w-5" /> Undo check-in (mistake)
                  </Button>
                )}
                {isAdmin && ["reserved", "cancelled", "no_show"].includes(b.status) && b.payments.length === 0 && (
                  <Button variant="outline" className="justify-start text-red-600" onClick={deleteBooking}>
                    <Trash2 className="h-5 w-5" /> Delete permanently
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AddChargeDialog booking={b} open={chargeOpen} onClose={() => setChargeOpen(false)} onDone={load} />
      <EditBookingDialog booking={b} open={editOpen} onClose={() => setEditOpen(false)} onDone={load} />
      {isAdmin && <PayoutDialog booking={b} open={payoutOpen} onClose={() => setPayoutOpen(false)} onDone={load} />}
      <PaymentDialog booking={b} open={refundOpen} refund onClose={() => setRefundOpen(false)} onDone={() => load()} />
      {actions.dialogs}
    </div>
  );
}
