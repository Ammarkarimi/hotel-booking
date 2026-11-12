"use client";

import { useEffect, useState } from "react";
import { Copy, IndianRupee, MessageCircle } from "lucide-react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { whatsappLink } from "@/lib/client";
import { payPagePath } from "@/lib/online-payments";
import { round2 } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";

/**
 * "Send payment link": a WhatsApp message with the booking's payment page, for the whole balance
 * or a smaller advance. The page shows the hotel's UPI QR and/or Razorpay's "Pay online".
 */
export function PaymentLinkDialog({
  open,
  onClose,
  booking,
  due,
}: {
  open: boolean;
  onClose: () => void;
  booking: { number: number; publicToken: string; guestName: string; guest: { phone: string } };
  /** What is still to pay: the group's balance for rooms booked together. */
  due: number;
}) {
  const { settings, toast } = useApp();
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (open) setAmount(String(round2(Math.max(0, due))));
  }, [open, due]);

  const n = Number(amount);
  const valid = n >= 1 && n <= due + 0.01;
  const partial = valid && n < due - 0.5;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${payPagePath(booking.publicToken, partial ? n : null)}`;
  const first = booking.guestName.split(" ")[0] || booking.guestName;
  const text = [
    `Dear ${first},`,
    `Please pay ${formatCurrency(valid ? n : due)}${partial ? " as an advance" : ""} for your booking #${booking.number} at ${settings.hotelName}.`,
    "",
    `Pay online here: ${url}`,
    "",
    "Thank you!",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Could not copy. Please select the link and copy it.", "error");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a payment link"
      description={`To ${booking.guestName} on WhatsApp (${booking.guest.phone}). Payments by Razorpay are added to the booking by themselves; for UPI to your own ID, check your bank and press Take payment.`}
      footer={
        <>
          <Button variant="outline" onClick={copy} disabled={!valid}>
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <a href={valid ? whatsappLink(booking.guest.phone, text) : undefined} target="_blank" rel="noopener noreferrer" onClick={() => valid && setTimeout(onClose, 300)}>
            <Button variant="success" disabled={!valid}>
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </Button>
          </a>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount to ask for" hint={`Still to pay: ${formatCurrency(due)}. For an advance, type a smaller amount.`}>
          <div className="relative">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-10 text-lg font-semibold" autoFocus />
          </div>
          {!valid && amount !== "" && <p className="mt-1 text-sm font-semibold text-red-600">Please enter an amount between ₹1 and {formatCurrency(due)}.</p>}
        </Field>
        <div className="rounded-2xl bg-[#ece5dd] p-3">
          <p className="whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[14px] leading-relaxed text-slate-800 shadow-sm">{text}</p>
        </div>
      </div>
    </Modal>
  );
}
