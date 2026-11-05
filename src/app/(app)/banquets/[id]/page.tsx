"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarCheck, ClipboardList, FileText, MessageCircle, Pencil, Plus, Printer, Receipt, Trash2, Undo2, Wallet, X } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, NumberInput, PageHeader, Row, Select, StatusBadge, Tip } from "@/components/ui";
import { MethodPicker } from "@/components/booking-actions";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { banquetBill, BANQUET_ITEM_CATEGORIES, FOOD_ITEM_CATEGORIES } from "@/lib/banquet-bill";
import type { BanquetDTO, BanquetSetup } from "@/lib/banquet-types";
import { formatCurrency, formatDate, formatDateTime, label, PAYMENT_METHODS } from "@/lib/utils";

type Dialog = null | "pay" | "refund" | "item" | "complete" | "cancel";

/** The WhatsApp message to the customer: the function, the bill and what is still to pay. */
function customerMessage(b: BanquetDTO, hotelName: string) {
  const m = (n: number) => formatCurrency(n);
  return [
    `Dear ${b.customerName},`,
    b.status === "enquiry"
      ? `Thank you for your enquiry at ${hotelName}. Here is our quotation:`
      : b.status === "completed"
        ? `Thank you for holding your function at ${hotelName}. Your bill:`
        : `Your function at ${hotelName} is ${b.status === "confirmed" ? "confirmed" : "on hold"}:`,
    `${label(b.eventType)}${b.eventName ? ` – ${b.eventName}` : ""}`,
    `${b.hall.name}, ${formatDate(b.eventDate)}, ${b.startTime} to ${b.endTime}`,
    `Guests: ${b.bill.billedPax}${b.menuName ? ` · Menu: ${b.menuName} (${label(b.foodType)})` : ""}`,
    `Total (incl. GST): ${m(b.bill.total)}`,
    b.bill.netPaid > 0 ? `Received: ${m(b.bill.netPaid)}` : "",
    b.status !== "enquiry" && b.bill.balance > 0.5 ? `Balance: ${m(b.bill.balance)}` : "",
    b.status === "tentative" && b.followUpOn ? `The hall is held for you until ${formatDate(b.followUpOn)}.` : "",
    b.status === "enquiry" && b.followUpOn ? `This quotation is valid until ${formatDate(b.followUpOn)}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function FunctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, confirm, isAdmin, settings } = useApp();
  const [b, setB] = useState<BanquetDTO | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<BanquetSetup | null>(null);
  // Dialog fields
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [plates, setPlates] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [giveBack, setGiveBack] = useState<number | null>(null);
  const [item, setItem] = useState({ category: "decoration", description: "", quantity: 1 as number | null, unitPrice: null as number | null, gstRate: 18 as number | null });

  const load = useCallback(() => {
    api<BanquetDTO>(`/api/banquets/${id}`)
      .then(setB)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    api<BanquetSetup>("/api/banquets/setup").then(setSetup).catch(() => setSetup(null));
  }, []);

  if (error) return <EmptyState title={error} action={<Link href="/banquets"><Button>All functions</Button></Link>} />;
  if (!b) return <Loading />;

  const f = b.bill;
  const money = (n: number) => formatCurrency(n);
  const isPast = b.eventDate <= settings.today;
  const open = b.status !== "cancelled" && b.status !== "completed";
  const canChange = b.status !== "cancelled" && (b.status !== "completed" || isAdmin);

  async function run(fn: () => Promise<BanquetDTO | unknown>, done: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r && typeof r === "object" && "id" in r) setB(r as BanquetDTO);
      else load();
      toast(done);
      setDialog(null);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function openDialog(d: Dialog) {
    setAmount(d === "pay" ? Math.max(0, Math.round(f.balance)) || null : d === "refund" ? f.netPaid : null);
    setMethod("cash");
    setReference("");
    setReason("");
    setGiveBack(null);
    setPlates(b!.actualPax ?? b!.expectedPax);
    setItem({ category: "decoration", description: "", quantity: 1, unitPrice: null, gstRate: setup?.defaults.itemGst ?? 18 });
    setDialog(d);
  }

  const setStatus = (status: "enquiry" | "tentative" | "confirmed") =>
    run(() => api(`/api/banquets/${id}`, { method: "PATCH", body: { action: "status", status } }), status === "confirmed" ? "Function confirmed" : status === "tentative" ? "The hall is on hold" : "Back to enquiry");

  async function remove() {
    const ok = await confirm({ title: `Delete function #${b!.number}?`, message: "Its items and payments are deleted too. This cannot be undone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/banquets/${id}`, { method: "DELETE" });
      toast("Function deleted");
      router.push("/banquets");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removeItem(itemId: string, what: string) {
    const ok = await confirm({ title: `Take “${what}” off the bill?`, confirmText: "Remove", danger: true });
    if (ok) run(() => api(`/api/banquets/${id}/items?itemId=${itemId}`, { method: "DELETE" }), "Item removed");
  }

  async function removePayment(paymentId: string) {
    const ok = await confirm({ title: "Delete this payment?", message: "Only for a payment entered by mistake.", confirmText: "Delete", danger: true });
    if (ok) run(() => api(`/api/payments?id=${paymentId}`, { method: "DELETE" }), "Payment deleted");
  }

  // What the final bill will be with the plates served typed in the dialog.
  const finalBill = banquetBill({ ...b, actualPax: plates ?? 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {b.customerName} <StatusBadge status={b.status} />
          </span>
        }
        description={`Function #${b.number} · ${label(b.eventType)}${b.eventName ? ` · ${b.eventName}` : ""}${b.invoiceNumber ? ` · Invoice ${b.invoiceNumber}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canChange && (
              <Link href={`/banquets/${id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4" /> Change
                </Button>
              </Link>
            )}
            <a href={whatsappLink(b.phone, customerMessage(b, settings.hotelName))} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          </div>
        }
      />

      {b.status === "cancelled" && (
        <Tip tone="danger">
          Cancelled{b.cancelledAt ? ` on ${formatDate(b.cancelledAt)}` : ""}: {b.cancelReason}.{" "}
          {f.netPaid > 0 ? `${money(f.netPaid)} of the advance was kept as cancellation charge.` : "Nothing was kept."}
        </Tip>
      )}
      {b.status === "enquiry" && <Tip>An enquiry does not hold the hall. Put it on hold or confirm it when the customer agrees.</Tip>}
      {b.status === "tentative" && b.followUpOn && b.followUpOn < settings.today && (
        <Tip tone="warning">The hold ended on {formatDate(b.followUpOn)}. Confirm the function or cancel it to free the hall.</Tip>
      )}
      {open && b.status !== "enquiry" && isPast && <Tip tone="warning">The function day has come. After it, enter the plates served and make the final bill.</Tip>}

      {/* What to do next */}
      {b.status !== "cancelled" && (
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            {b.status === "enquiry" && (
              <>
                <Button variant="success" onClick={() => setStatus("confirmed")} loading={busy}>
                  <CalendarCheck className="h-4 w-4" /> Confirm
                </Button>
                <Button variant="outline" onClick={() => setStatus("tentative")} loading={busy}>
                  Put the hall on hold
                </Button>
              </>
            )}
            {b.status === "tentative" && (
              <>
                <Button variant="success" onClick={() => setStatus("confirmed")} loading={busy}>
                  <CalendarCheck className="h-4 w-4" /> Confirm
                </Button>
                {f.netPaid <= 0 && (
                  <Button variant="outline" onClick={() => setStatus("enquiry")} loading={busy}>
                    <Undo2 className="h-4 w-4" /> Free the hall (back to enquiry)
                  </Button>
                )}
              </>
            )}
            {(b.status === "confirmed" || b.status === "tentative") && isPast && (
              <Button onClick={() => openDialog("complete")}>
                <Receipt className="h-4 w-4" /> Make final bill
              </Button>
            )}
            {b.status !== "enquiry" && (
              <Button variant={f.balance > 0.5 ? "primary" : "outline"} onClick={() => openDialog("pay")}>
                <Wallet className="h-4 w-4" /> {b.status === "completed" ? "Take payment" : "Take advance"}
              </Button>
            )}
            {f.netPaid > 0 && (
              <Button variant="outline" onClick={() => openDialog("refund")}>
                <Undo2 className="h-4 w-4" /> Give money back
              </Button>
            )}
            {canChange && (
              <Button variant="outline" onClick={() => openDialog("item")}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
            )}
            {open && (
              <Button variant="outline" className="text-red-700" onClick={() => openDialog("cancel")}>
                <Ban className="h-4 w-4" /> Cancel function
              </Button>
            )}
            {isAdmin && !b.invoiceNumber && (
              <Button variant="ghost" className="text-red-700" onClick={remove}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Function" />
            <CardContent className="grid gap-x-8 sm:grid-cols-2">
              <Row label="Hall">{b.hall.name}</Row>
              <Row label="Date">{formatDate(b.eventDate)}</Row>
              <Row label="Session">{label(b.session)}</Row>
              <Row label="Time">
                {b.startTime} – {b.endTime}
                {b.endTime <= b.startTime && " (next day)"}
              </Row>
              <Row label="Guests expected">{b.expectedPax}</Row>
              <Row label="Guaranteed plates">{b.guaranteedPax || "—"}</Row>
              <Row label="Plates served">{b.actualPax ?? "—"}</Row>
              <Row label="Seating">{b.seating ? label(b.seating) : "—"}</Row>
              {b.followUpOn && <Row label={b.status === "tentative" ? "Hall held until" : "Follow up on"}>{formatDate(b.followUpOn)}</Row>}
              <Row label="Booked by">{b.createdByName ?? "—"}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <CardContent className="grid gap-x-8 sm:grid-cols-2">
              <Row label="Name">{b.customerName}</Row>
              <Row label="Mobile">
                <a href={`tel:${b.phone}`} className="text-primary-700 hover:underline">
                  {b.phone}
                </a>
              </Row>
              {b.company && <Row label="Company">{b.company}</Row>}
              {b.gstin && <Row label="GSTIN">{b.gstin}</Row>}
              {b.email && <Row label="Email">{b.email}</Row>}
              {b.address && <Row label="Address">{b.address}</Row>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={`Food${b.menuName ? ` · ${b.menuName}` : ""}`} description={`${label(b.foodType)} · ${money(b.platePrice)} a plate`} />
            <CardContent>
              {b.menuItems ? <p className="whitespace-pre-line text-sm text-slate-700">{b.menuItems}</p> : <p className="text-sm text-slate-500">No dishes written yet.</p>}
            </CardContent>
            {(b.requirements || b.notes) && (
              <CardContent className="space-y-2 border-t border-slate-100 text-sm">
                {b.requirements && (
                  <p className="whitespace-pre-line">
                    <span className="font-semibold">Requirements: </span>
                    {b.requirements}
                  </p>
                )}
                {b.notes && (
                  <p className="whitespace-pre-line">
                    <span className="font-semibold">Notes: </span>
                    {b.notes}
                  </p>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader title="Payments" description="Counted in Payments, the cash drawer and the staff shift report." />
            {b.payments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No money received yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-semibold">
                        {label(p.type)} · {label(p.method)}
                        {p.reference && <span className="font-normal text-slate-500"> ({p.reference})</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(p.paidAt, settings.timezone)}
                        {p.receivedBy && ` · ${p.receivedBy}`}
                        {p.notes && ` · ${p.notes}`}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <span className={p.type === "refund" ? "font-bold text-violet-700" : "font-bold text-emerald-700"}>
                        {p.type === "refund" ? "− " : ""}
                        {money(p.amount)}
                      </span>
                      {isAdmin && (
                        <button onClick={() => removePayment(p.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete payment">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Bill" description={b.invoiceNumber ? `Final bill ${b.invoiceNumber}` : b.status === "enquiry" ? "Quotation" : "Before the final bill"} />
            <CardContent>
              <Row label={`Food: ${f.billedPax} × ${money(b.platePrice)}`}>{money(f.food)}</Row>
              {f.billedPax > (b.actualPax ?? b.expectedPax) && <p className="-mt-1 mb-1 text-xs text-slate-500">Guaranteed plates are charged.</p>}
              <Row label="Hall rent">{money(f.hall)}</Row>
              {b.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 py-1.5 text-[15px]">
                  <span className="text-slate-600">
                    {i.description}
                    <span className="text-xs text-slate-400">
                      {" "}
                      {i.quantity !== 1 ? `${i.quantity} × ${money(i.unitPrice)} · ` : ""}GST {i.gstRate}%
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    {money(i.amount)}
                    {canChange && (
                      <button onClick={() => removeItem(i.id, i.description)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${i.description}`}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {f.discount > 0 && <Row label="Discount">− {money(f.discount)}</Row>}
              <Row label="Taxable value">{money(f.taxable)}</Row>
              {f.taxLines
                .filter((l) => l.tax > 0)
                .map((l) => (
                  <Row key={l.rate} label={`GST ${l.rate}% (CGST + SGST)`}>
                    {money(l.tax)}
                  </Row>
                ))}
              <Row label="Total" strong>
                {money(f.total)}
              </Row>
              <Row label="Paid">{money(f.netPaid)}</Row>
              {b.status !== "cancelled" && (
                <div className={f.balance > 0.5 ? "mt-2 rounded-xl bg-red-50 px-4 py-3 text-red-700" : "mt-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700"}>
                  <Row label={f.balance > 0.5 ? "Still to pay" : f.balance < -0.5 ? "Paid extra — give back" : "Fully paid"} strong>
                    {money(Math.abs(f.balance))}
                  </Row>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Print" />
            <CardContent className="grid gap-2">
              <a href={`/print/banquet/${id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  {b.invoiceNumber ? <Receipt className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {b.invoiceNumber ? "Tax invoice" : b.status === "enquiry" ? "Quotation" : "Booking confirmation"}
                </Button>
              </a>
              <a href={`/print/function-sheet/${id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  <ClipboardList className="h-4 w-4" /> Function sheet (kitchen & staff)
                </Button>
              </a>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Printer className="h-3.5 w-3.5" /> Opens in a new tab, ready to print or save as PDF.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Take money / give it back */}
      <Modal
        open={dialog === "pay" || dialog === "refund"}
        onClose={() => setDialog(null)}
        title={dialog === "refund" ? "Give money back" : b.status === "completed" ? "Take payment" : "Take advance"}
        description={dialog === "refund" ? `Received so far: ${money(f.netPaid)}` : f.balance > 0.5 ? `Still to pay: ${money(f.balance)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Close
            </Button>
            <Button
              loading={busy}
              disabled={!amount || amount <= 0}
              onClick={() =>
                run(
                  () => api(`/api/banquets/${id}/payments`, { body: { amount, method, reference: reference || null, refund: dialog === "refund" } }),
                  dialog === "refund" ? "Money given back" : "Payment saved"
                )
              }
            >
              {dialog === "refund" ? "Save refund" : "Save payment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount">
            <NumberInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <MethodPicker value={method} onChange={setMethod} methods={PAYMENT_METHODS} />
          <Field label="Reference" optional hint="UPI / cheque / transaction number.">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Extra item */}
      <Modal
        open={dialog === "item"}
        onClose={() => setDialog(null)}
        title="Add item to the bill"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Close
            </Button>
            <Button
              loading={busy}
              disabled={!item.description.trim() || item.unitPrice === null}
              onClick={() => run(() => api(`/api/banquets/${id}/items`, { body: { ...item, quantity: item.quantity ?? 1, gstRate: item.gstRate ?? 0 } }), "Item added")}
            >
              Add item
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <Select
              value={item.category}
              onChange={(e) => {
                const category = e.target.value;
                setItem((i) => ({ ...i, category, gstRate: FOOD_ITEM_CATEGORIES.includes(category) ? b.foodGst : (setup?.defaults.itemGst ?? 18) }));
              }}
            >
              {BANQUET_ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What">
            <Input value={item.description} onChange={(e) => setItem((i) => ({ ...i, description: e.target.value }))} placeholder="e.g. 40 non-veg plates" />
          </Field>
          <Field label="Quantity">
            <NumberInput value={item.quantity} onChange={(q) => setItem((i) => ({ ...i, quantity: q }))} />
          </Field>
          <Field label="Price (each)">
            <NumberInput value={item.unitPrice} onChange={(p) => setItem((i) => ({ ...i, unitPrice: p }))} />
          </Field>
          <Field label="GST %">
            <NumberInput value={item.gstRate} onChange={(g) => setItem((i) => ({ ...i, gstRate: g }))} />
          </Field>
          <div className="self-end pb-2 text-right text-sm">
            Amount: <b>{money((item.quantity ?? 0) * (item.unitPrice ?? 0))}</b>
          </div>
        </div>
      </Modal>

      {/* Final bill */}
      <Modal
        open={dialog === "complete"}
        onClose={() => setDialog(null)}
        title="Make the final bill"
        description="Gives the bill an invoice number. After this only the owner can change it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Close
            </Button>
            <Button loading={busy} disabled={plates === null} onClick={() => run(() => api(`/api/banquets/${id}`, { method: "PATCH", body: { action: "complete", actualPax: plates } }), "Final bill made")}>
              Make final bill
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Plates served" hint={b.guaranteedPax ? `At least the ${b.guaranteedPax} guaranteed plates are charged.` : undefined}>
            <NumberInput value={plates} onChange={(n) => setPlates(n === null ? null : Math.round(n))} autoFocus />
          </Field>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <Row label={`Food: ${finalBill.billedPax} × ${money(b.platePrice)}`}>{money(finalBill.food)}</Row>
            <Row label="Hall rent and extras">{money(finalBill.hall + finalBill.extras)}</Row>
            {finalBill.discount > 0 && <Row label="Discount">− {money(finalBill.discount)}</Row>}
            <Row label="GST">{money(finalBill.tax)}</Row>
            <Row label="Total" strong>
              {money(finalBill.total)}
            </Row>
            <Row label="Paid">{money(finalBill.netPaid)}</Row>
            <Row label={finalBill.balance >= 0 ? "Still to pay" : "Paid extra"} strong>
              {money(Math.abs(finalBill.balance))}
            </Row>
          </div>
        </div>
      </Modal>

      {/* Cancel */}
      <Modal
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={`Cancel function #${b.number}?`}
        description="The hall becomes free again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reason.trim()}
              onClick={() =>
                run(
                  () =>
                    api(`/api/banquets/${id}`, {
                      method: "PATCH",
                      body: { action: "cancel", reason, refund: giveBack && giveBack > 0 ? { amount: giveBack, method } : null },
                    }),
                  "Function cancelled"
                )
              }
            >
              Cancel function
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Why">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. date changed, booked elsewhere" autoFocus />
          </Field>
          {f.netPaid > 0 && (
            <>
              <Field label="Give back to the customer" hint={`Advance received: ${money(f.netPaid)}. What is not given back is kept as cancellation charge.`}>
                <NumberInput value={giveBack} onChange={setGiveBack} />
              </Field>
              {(giveBack ?? 0) > 0 && <MethodPicker value={method} onChange={setMethod} methods={PAYMENT_METHODS} />}
              <p className="text-sm">
                Kept as cancellation charge: <b>{money(Math.max(0, f.netPaid - (giveBack ?? 0)))}</b>
              </p>
            </>
          )}
        </div>
      </Modal>

      {b.status === "completed" && f.balance <= 0.5 && f.balance >= -0.5 && (
        <p className="text-center text-sm text-slate-500">
          <Badge variant="paid">Fully paid</Badge> Final bill {b.invoiceNumber}
        </p>
      )}
    </div>
  );
}
