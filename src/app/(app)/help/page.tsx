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
    q: "How do I start and end my shift?",
    steps: [
      "When you sign in, read the handover notes from the last shift, then press “Start my shift”. A timer runs at the top of the screen.",
      "Before you leave, press “End shift”. Write a handover note for the next person (for example “Room 203 is staying 2 hours more and will pay ₹500”).",
      "Type the code shown on the screen and press “End shift”.",
      "Press “Send to owner on WhatsApp” to send your shift report, then sign out.",
      "Your note and report are saved and cannot be changed later. If the front desk is full when you sign in, choose whose shift you are taking over. They get a message to confirm with their handover note, and your shift starts as soon as they accept. If someone asks to take over your shift, write your handover note and press “Accept & hand over”, or “Not now”.",
    ],
  },
  {
    q: "How do I count cash at the end of my shift?",
    steps: [
      "Open “Payments” and choose “Today”.",
      "The “Cash drawer” box shows cash received from guests, minus cash paid for expenses. The last line is the cash you should have.",
    ],
    link: { href: "/payments", text: "Open payments" },
  },
  {
    q: "I paid for something for the hotel. Where do I write it down?",
    steps: [
      "Open “Expenses” and press “Add expense”.",
      "Type the amount and what it was for (e.g. “20 bedsheets”), choose the kind of cost and how you paid, then press “Save expense”.",
      "You can fix your own entry on the same day by tapping it. The owner sees every expense in Reports.",
    ],
    link: { href: "/expenses", text: "Open expenses" },
  },
  {
    q: "How do I get a guest's details and ID before they arrive?",
    steps: [
      "Press “Send guest form” on Today. Type the guest's WhatsApp number (and name and dates if you know them), then press “Send on WhatsApp”.",
      "The guest fills in their details. For each adult they choose Aadhaar (shown at check-in) or upload a photo of another ID.",
      "When they send it you get a pop-up and a red number on “Guest forms”. Press “Choose room & book”: everything is filled in, you only pick the room and price.",
      "Something wrong in what the guest filled in? Press “Edit details” on the form and correct it. After booking, use “Change” on the booking for the journey, vehicle and other adults' names, and “Edit” on the guest's profile for their own details.",
    ],
    link: { href: "/guest-forms", text: "Open guest forms" },
  },
  {
    q: "Can I change the WhatsApp messages sent to guests?",
    steps: [
      "Yes. Open Settings → WhatsApp messages (owner / manager).",
      "Change the booking confirmation, the welcome at check-in and the thank-you at check-out. Tap a detail such as “Hotel check-out time” to add it where the cursor is. You see an example of what the guest receives.",
      "Press Save. After every check-in and check-out the front desk is offered the message with a “Send on WhatsApp” button.",
    ],
    link: { href: "/settings?tab=messages", text: "Open WhatsApp messages" },
  },
  {
    q: "How do I check a guest's ID at check-in?",
    steps: [
      "Open the booking. “ID check” lists every adult.",
      "Look at each person's original ID (Aadhaar card or app, driving licence, voter ID…) and check the photo is them.",
      "Choose which ID they showed and tick the box. Only who verified it and when is saved; nothing from an Aadhaar is kept.",
    ],
  },
  {
    q: "For owners: who worked when, and what did they leave for the next shift?",
    steps: [
      "Open “Staff shifts” for attendance: when each person started and ended, hours worked, check-ins, check-outs and money received.",
      "Press “Download staff report” for one Excel file with a row for every shift (date, times, hours, bookings checked in and out, money, notes as saved) and totals per person.",
      "Every handover note is there, and the latest ones also show on the Today screen.",
      "If someone forgot to end their shift, press “Close shift”. Turn shifts on or off, and set your WhatsApp number for shift reports, in Settings → Staff.",
    ],
    link: { href: "/shifts", text: "Open staff shifts" },
  },
  {
    q: "For owners: how is my hotel doing?",
    steps: [
      "Open “Reports” and choose Day, Week, Month or Year. Use the arrows to go back or forward, or “Choose dates”.",
      "Profit is your room and extras earnings minus your expenses (before GST).",
      "“Earnings per available room” (RevPAR) divides room earnings by all your rooms, sold or empty. “Cost per available room” does the same with expenses.",
      "Download any part for Excel, or press “Print / save PDF”.",
    ],
    link: { href: "/reports", text: "Open reports" },
  },
  {
    q: "For owners: MakeMyTrip, Goibibo or Booking.com paid us less than the bill",
    steps: [
      "That's normal: the bill and GST invoice stay on the full amount, and the site takes off its commission, GST on it, TCS and TDS.",
      "If the guest paid on the site, take the payment as “Booking site (prepaid)” so their bill shows paid.",
      "On the booking, open “Booking site payout” and type the deductions from the site's statement (or just the amount it pays you). Tick “The money has reached our bank” when it arrives.",
      "Reports → “Booking site payouts” shows gross, deductions, what the sites pay, and what is still waiting. Download it for Excel to match against the site's own sheet.",
    ],
    link: { href: "/reports", text: "Open reports" },
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
