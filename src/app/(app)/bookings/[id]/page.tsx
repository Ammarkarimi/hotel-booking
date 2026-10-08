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
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, Row, Select, StatusBadge, Textarea, Tip } from "@/components/ui";
import { PaymentDialog, useBookingActions } from "@/components/booking-actions";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays, diffDays } from "@/lib/dates";
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

function EditBookingDialog({ booking, open, onClose, onDone }: { booking: BookingDetailDTO; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast, settings } = useApp();
  const [form, setForm] = useState({
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    roomId: booking.room.id,
    ratePerNight: String(booking.ratePerNight),
    discount: String(booking.discount || ""),
    adults: String(booking.adults),
    children: String(booking.children),
    source: booking.source,
    notes: booking.notes || "",
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
      adults: String(booking.adults),
      children: String(booking.children),
      source: booking.source,
      notes: booking.notes || "",
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
        adults: Number(form.adults),
        children: Number(form.children),
        source: form.source,
        notes: form.notes,
      };
      if (!started) body.checkInDate = form.checkInDate;
      if (Number(form.ratePerNight) !== booking.ratePerNight) body.ratePerNight = Number(form.ratePerNight);
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
    <Modal open={open} onClose={onClose} title="Change booking" description="Change dates, extend the stay, move to another room, or change the price." size="lg">
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
            <Input type="number" min={0} value={form.ratePerNight} onChange={(e) => setForm({ ...form, ratePerNight: e.target.value })} />
          </Field>
          <Field label="Discount (amount)">
            <Input type="number" min={0} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Adults">
            <Input type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
          </Field>
          <Field label="Children">
            <Input type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
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
        <Field label="Notes" optional>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={nights < 1 || !roomFree}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast, confirm, isAdmin, settings: shell } = useApp();
  const [b, setB] = useState<BookingDetailDTO | null>(null);
  const [error, setError] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
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

  const shareText = [
    `Dear ${b.guestName},`,
    `Your booking at ${s.hotelName}: #${b.number}`,
    `Room ${b.room.roomNumber} (${label(b.room.type)})`,
    `${formatDate(b.checkInDate)} → ${formatDate(b.checkOutDate)} (${f.nightCount} night${f.nightCount > 1 ? "s" : ""})`,
    `Total: ${formatCurrency(f.grandTotal)} · Paid: ${formatCurrency(f.netPaid)} · Balance: ${formatCurrency(Math.max(0, f.balance))}`,
    s.phone ? `Call us: ${s.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
              <Row label={`Tax on room (${f.roomTaxRate}%)`}>{formatCurrency(f.roomTax)}</Row>
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
                ID: {b.guest.idType ? `${label(b.guest.idType)} ${b.guest.idNumber ?? ""}` : "not entered"} ·{" "}
                {b.guest.documents.length > 0 ? (
                  <span className="text-emerald-700">{b.guest.documents.length} document(s) uploaded</span>
                ) : (
                  <Link href={`/guests/${b.guest.id}`} className="font-semibold text-amber-700 hover:underline">
                    Upload ID photo
                  </Link>
                )}
              </p>
              <a href={whatsappLink(b.guest.phone, shareText)} target="_blank" rel="noopener noreferrer" className="block pt-1">
                <Button variant="success" size="sm" className="w-full">
                  <MessageCircle className="h-4 w-4" /> Send details on WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>

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
      <PaymentDialog booking={b} open={refundOpen} refund onClose={() => setRefundOpen(false)} onDone={() => load()} />
      {actions.dialogs}
    </div>
  );
}
