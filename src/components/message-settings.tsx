"use client";

import { useRef } from "react";
import { MessageCircle, RotateCcw } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Tip } from "@/components/ui";
import { DEFAULT_MESSAGES, MESSAGE_FIELDS, MESSAGE_KINDS, MESSAGE_TITLES, bookingMessage, type MessageKind } from "@/lib/messages";
import { addDays } from "@/lib/dates";
import type { SettingsDTO } from "@/lib/types";

const FIELD_OF: Record<MessageKind, "msgBooking" | "msgCheckIn" | "msgCheckOut"> = { booking: "msgBooking", checkIn: "msgCheckIn", checkOut: "msgCheckOut" };

/** A made-up stay, to show what the guest will receive. */
function sampleBooking(kind: MessageKind, today: string) {
  const checkOutDate = addDays(today, 2);
  return {
    guestName: "Asha Rao",
    number: 1022,
    adults: 2,
    children: 1,
    checkInDate: today,
    checkOutDate,
    actualCheckIn: kind === "booking" ? null : `${today}T09:05:00Z`,
    actualCheckOut: kind === "checkOut" ? `${checkOutDate}T05:00:00Z` : null,
    room: { roomNumber: "204", type: "deluxe" },
    folio: { grandTotal: 10080, netPaid: kind === "checkOut" ? 10080 : 2000, balance: kind === "checkOut" ? 0 : 8080, nightCount: 2 },
    bill: kind === "checkOut" ? { invoiceNumber: "INV-1022" } : null,
  };
}

function MessageEditor({ kind, s, set, today }: { kind: MessageKind; s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void; today: string }) {
  const field = FIELD_OF[kind];
  const box = useRef<HTMLTextAreaElement>(null);
  // Until the owner clicks into the box, details go at the end; after that, where the cursor is.
  const used = useRef(false);
  const custom = s[field];
  const text = custom ?? DEFAULT_MESSAGES[kind];
  // Wording that matches the default is saved as "default", so later improvements reach this hotel too.
  const change = (v: string) => set({ [field]: v.trim() === DEFAULT_MESSAGES[kind].trim() ? null : v });

  function insert(key: string) {
    const el = box.current;
    const token = `{${key}}`;
    const at = (n: number | undefined) => Math.min(used.current && el ? (n ?? text.length) : text.length, text.length);
    const start = at(el?.selectionStart);
    const end = at(el?.selectionEnd);
    change(text.slice(0, start) + token + text.slice(end));
    used.current = true;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const preview = bookingMessage(kind, sampleBooking(kind, today), {
    hotelName: s.hotelName,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    phone: s.phone,
    address: [s.address, s.city].filter(Boolean).join(", "),
    currency: s.currency,
    timezone: s.timezone,
    messages: { [kind]: text },
  });

  return (
    <Card className="mb-6">
      <CardHeader
        title={MESSAGE_TITLES[kind].title}
        description={MESSAGE_TITLES[kind].when}
        action={
          custom !== null && (
            <Button size="sm" variant="outline" onClick={() => set({ [field]: null })}>
              <RotateCcw className="h-4 w-4" /> Use the default
            </Button>
          )
        }
      />
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <label htmlFor={`msg-${kind}`} className="block text-sm font-semibold text-slate-700">
            Message {custom === null && <span className="font-normal text-slate-400">(default wording)</span>}
          </label>
          <textarea
            id={`msg-${kind}`}
            ref={box}
            value={text}
            onChange={(e) => change(e.target.value)}
            onFocus={() => (used.current = true)}
            rows={16}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-slate-900 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
          />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">Tap to add a detail where the cursor is:</p>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_FIELDS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => insert(f.key)}
                  title={`{${f.key}}`}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-primary-50 hover:text-primary-700"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <MessageCircle className="h-4 w-4 text-emerald-600" /> What the guest receives (example)
          </p>
          <div className="rounded-2xl bg-[#ece5dd] p-3">
            <p className="whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[14px] leading-relaxed text-slate-800 shadow-sm">{preview}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Settings → WhatsApp messages: the owner's wording for the messages staff send to guests. */
export function MessageSettings({ s, set, today }: { s: SettingsDTO; set: (p: Partial<SettingsDTO>) => void; today: string }) {
  return (
    <>
      <Tip>
        Staff send these from the booking: a confirmation when the booking is made, a welcome right after check-in, and a thank-you
        after check-out. Words in {"{curly brackets}"} are filled in from the booking. A line whose detail is missing (for example no
        invoice yet) is left out. Press Save at the bottom when you are done.
      </Tip>
      <div className="mt-6">
        {MESSAGE_KINDS.map((k) => (
          <MessageEditor key={k} kind={k} s={s} set={set} today={today} />
        ))}
      </div>
    </>
  );
}
