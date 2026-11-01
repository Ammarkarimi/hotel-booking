"use client";

import { MessageCircle } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { whatsappLink } from "@/lib/client";
import { bookingMessage, type MessageBooking, type MessageKind } from "@/lib/messages";

/** Builds a guest message in the owner's wording (Settings → WhatsApp messages). */
export function useGuestMessage() {
  const { settings } = useApp();
  return (kind: MessageKind, b: MessageBooking) => bookingMessage(kind, b, settings);
}

const TITLES: Record<MessageKind, string> = {
  booking: "Send the booking confirmation?",
  checkIn: "Send the welcome message?",
  checkOut: "Send the thank-you message?",
};

/** Offered right after check-in or check-out: shows the message and opens WhatsApp when tapped. */
export function SendGuestMessageDialog({
  open,
  onClose,
  kind,
  booking,
}: {
  open: boolean;
  onClose: () => void;
  kind: MessageKind;
  booking: (MessageBooking & { guest: { phone: string } }) | null;
}) {
  const message = useGuestMessage();
  if (!booking) return null;
  const text = message(kind, booking);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[kind]}
      description={`To ${booking.guestName} on WhatsApp (${booking.guest.phone}). You can change the wording in Settings → WhatsApp messages.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <a href={whatsappLink(booking.guest.phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 300)}>
            <Button variant="success">
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </Button>
          </a>
        </>
      }
    >
      <div className="rounded-2xl bg-[#ece5dd] p-3">
        <p className="whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[14px] leading-relaxed text-slate-800 shadow-sm">{text}</p>
      </div>
    </Modal>
  );
}
