import Link from "next/link";
import { Card, CardContent, PageHeader } from "@/components/ui";

const GUIDES: Array<{ q: string; steps: string[]; link?: { href: string; text: string } }> = [
  {
    q: "How do I take a booking?",
    steps: [
      "Press the blue “New booking” button at the top of any screen.",
      "Choose the arrival and leaving dates (or tap “2 nights”, “3 nights”…).",
      "Pick one of the free rooms. The total price is shown on each room.",
      "Type the guest's name and mobile number. If they stayed before, search their name and tap “Choose”.",
      "If the guest paid an advance, type the amount and how they paid. Press “Confirm booking”.",
      "Press “Send on WhatsApp” to send the guest their confirmation.",
    ],
    link: { href: "/bookings/new", text: "Make a booking now" },
  },
  {
    q: "A guest walked in without a booking",
    steps: ["On the Today screen, press the green “Walk-in guest” button.", "Follow the same steps as a booking. The guest is checked in as soon as you confirm."],
    link: { href: "/bookings/new?walkin=1", text: "Walk-in guest" },
  },
  {
    q: "How do I check a guest in?",
    steps: [
      "Open the Today screen. Guests arriving today are listed under “Arriving today”.",
      "Press “Check in” next to the guest's name and confirm.",
      "Take a photo of their ID: open the guest's profile and press “Take photo of ID”.",
    ],
  },
  {
    q: "How do I check a guest out and take payment?",
    steps: [
      "On the Today screen, find the guest under “Leaving today” and press “Check out”.",
      "The bill is shown with the amount still to pay. Choose Cash / UPI / Card and press “Take … & check out”.",
      "Print the invoice from the booking page if the guest wants one.",
      "The room is automatically marked “Needs cleaning”.",
    ],
  },
  {
    q: "The guest ordered food / used laundry",
    steps: ["Open the guest's booking (search their name at the top).", "In the Bill box press “Add item”, choose the type, type the price and press “Add to bill”."],
  },
  {
    q: "The guest wants to stay longer, leave early or change room",
    steps: [
      "Open the booking and press “Change” in the Stay box.",
      "To stay longer, press “Extend +1 night” or choose a later leaving date.",
      "To move rooms, choose a different room from the list (only free rooms are shown).",
      "Leaving early? Just press “Check out” — you can choose to charge only the nights stayed.",
    ],
  },
  {
    q: "How do I see which rooms are free?",
    steps: ["Open “Room Calendar”. Coloured bars are bookings; empty white boxes are free.", "Tap an empty box to book that room from that day."],
    link: { href: "/calendar", text: "Open the room calendar" },
  },
  {
    q: "A guest cancelled or did not come",
    steps: [
      "Open the booking. Press “Cancel booking” (or “Guest did not come” on/after the arrival day).",
      "If you return any advance, press “Refund” in the Payments box and record the amount.",
    ],
  },
  {
    q: "How do I count cash at the end of my shift?",
    steps: ["Open “Payments” and choose “Today”. The Cash box shows the cash you should have."],
    link: { href: "/payments", text: "Open payments" },
  },
  {
    q: "For owners: setting up the hotel",
    steps: [
      "Settings → Hotel details: name, address, phone, GSTIN, check-in and check-out time.",
      "Rooms → Add room: add every room with its type and normal price.",
      "Settings → Prices & tax: choose Indian GST slabs or a fixed tax, weekend price change and festival prices.",
      "Settings → Staff: give each staff member their own sign-in. Front-desk accounts cannot see reports or delete records.",
      "Settings → Online booking: copy your booking link and share it on WhatsApp, Instagram and Google Maps.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Help & guide" description="Short answers to everyday questions. Tap a question to open it." />
      <div className="space-y-3">
        {GUIDES.map((g, i) => (
          <Card key={g.q}>
            <details className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[17px] font-semibold">
                {g.q}
                <span className="text-2xl text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <CardContent className="pt-0">
                <ol className="list-decimal space-y-2 pl-5 text-[15px] text-slate-700">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {g.link && (
                  <Link href={g.link.href} className="mt-3 inline-block font-semibold text-primary-600 hover:underline">
                    {g.link.text} →
                  </Link>
                )}
              </CardContent>
            </details>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Colours mean the same thing everywhere: <b className="text-emerald-700">green</b> = free / clean / paid, <b className="text-sky-700">blue</b> = guest staying,{" "}
        <b className="text-amber-700">yellow</b> = booked / arriving / part paid, <b className="text-red-700">red</b> = needs cleaning / money owed.
      </p>
    </div>
  );
}
