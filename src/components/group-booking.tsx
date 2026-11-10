"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BedDouble, IndianRupee, Printer, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Modal, StatusBadge } from "@/components/ui";
import { MethodPicker } from "@/components/booking-actions";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { GroupSummary } from "@/lib/groups";
import { cn, formatCurrency, label } from "@/lib/utils";

/** On a booking that is one of several rooms booked together: every room, and the group's totals. */
export function GroupCard({ group, currentId, onPay }: { group: GroupSummary; currentId: string; onPay: () => void }) {
  return (
    <Card>
      <CardHeader
        title={`Group booking · ${group.rooms.length} rooms`}
        description="Booked together for the same guest and dates. Each room has its own bill and invoice."
      />
      <ul className="divide-y divide-slate-100">
        {group.rooms.map((r) => (
          <li key={r.id} className={cn("flex items-center justify-between gap-3 px-5 py-2.5", r.id === currentId && "bg-primary-50/60")}>
            <div className="min-w-0">
              <Link href={`/bookings/${r.id}`} className="font-semibold text-primary-700 hover:underline">
                <BedDouble className="mr-1 inline h-4 w-4" />
                Room {r.roomNumber}
              </Link>
              <span className="ml-1 text-sm text-slate-500">
                #{r.number} · {label(r.roomType)} · {r.adults} adult{r.adults === 1 ? "" : "s"}
              </span>
              <div className="mt-0.5">
                <StatusBadge status={r.status} />
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{formatCurrency(r.total)}</p>
              {r.balance > 0.5 && !["cancelled", "no_show"].includes(r.status) && <p className="text-red-600">{formatCurrency(r.balance)} due</p>}
            </div>
          </li>
        ))}
      </ul>
      <CardContent className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex justify-between text-[15px]">
          <span className="text-slate-600">Group total</span>
          <b>{formatCurrency(group.total)}</b>
        </div>
        <div className="flex justify-between text-[15px]">
          <span className="text-slate-600">Paid</span>
          <span>{formatCurrency(group.paid)}</span>
        </div>
        <div className={cn("flex justify-between text-lg font-bold", group.balance > 0.5 ? "text-red-700" : "text-emerald-700")}>
          <span>{group.balance > 0.5 ? "Still to pay" : "Fully paid"}</span>
          <span>{formatCurrency(group.balance)}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {group.balance > 0.5 && (
            <Button size="sm" variant="success" onClick={onPay}>
              <Wallet className="h-4 w-4" /> Take payment for all rooms
            </Button>
          )}
          <a href={`/print/group/${currentId}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Printer className="h-4 w-4" /> Group bill
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

/** One payment for all the rooms of a group, shared out over their bills by the server. */
export function GroupPaymentDialog({ bookingId, group, open, onClose, onDone }: { bookingId: string; group: GroupSummary; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(group.balance > 0 ? String(Math.round(group.balance * 100) / 100) : "");
    setMethod("upi");
    setReference("");
  }, [open, group.balance]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/bookings/${bookingId}/group-payment`, { body: { amount: Number(amount), method, reference } });
      toast(`${formatCurrency(Number(amount))} received for the group. Thank you!`);
      onDone();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Take payment for all rooms" description="The payment pays off each room's bill in turn. Anything extra stays on this room.">
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-[15px]">
          <div className="flex justify-between">
            <span>Group total</span>
            <span>{formatCurrency(group.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Already paid</span>
            <span>{formatCurrency(group.paid)}</span>
          </div>
          <div className="flex justify-between font-bold text-red-600">
            <span>Still to pay</span>
            <span>{formatCurrency(group.balance)}</span>
          </div>
        </div>
        <Field label="Amount" hint="How much is the guest paying now for all the rooms?">
          <div className="relative">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-10 text-lg font-semibold" />
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
          <Button type="submit" variant="success" loading={saving} disabled={!Number(amount)}>
            Save payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
