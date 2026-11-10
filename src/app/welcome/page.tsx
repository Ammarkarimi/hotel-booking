import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import {
  Banknote,
  BarChart3,
  BedDouble,
  CalendarDays,
  CalendarPlus,
  Printer,
  Check,
  ClipboardCheck,
  Clock,
  DoorOpen,
  FilePenLine,
  FileText,
  Globe,
  History,
  IdCard,
  IndianRupee,
  Landmark,
  Mail,
  MessageCircle,
  MessageSquareText,
  Play,
  Receipt,
  Repeat,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tags,
  TrendingDown,
  UserCheck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";
import { PlayTourButton, TourPlayer } from "./tour";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { absolute: "Innvela · Hotel software for boutique and premium hotels" },
  description:
    "Reservations, express check-in on WhatsApp, ID checks, polished GST invoices, housekeeping, staff shifts, expenses, profit reports and your own commission-free booking website. Hotel software for boutique hotels, resorts and premium stays.",
  openGraph: {
    title: "Innvela · Hotel software for boutique and premium hotels",
    description: "Effortless front desk software for boutique hotels, resorts and premium stays, with your own commission-free booking website.",
    images: [{ url: "/welcome/og-image.jpg", width: 1280, height: 720 }],
  },
};

// Optional contact details shown on the page, set in the hosting settings (see docs/hosting.md).
const salesWhatsapp = (process.env.SALES_WHATSAPP || "").replace(/[^\d]/g, "");
const salesEmail = (process.env.SALES_EMAIL || "").trim();
const whatsappHref = salesWhatsapp
  ? `https://wa.me/${salesWhatsapp}?text=${encodeURIComponent("Hello, I'd like a demo of Innvela for my property.")}`
  : null;
const emailHref = salesEmail ? `mailto:${salesEmail}?subject=${encodeURIComponent("Innvela demo for my property")}` : null;

const FEATURE_GROUPS = [
  {
    title: "Front desk",
    items: [
      { icon: ClipboardCheck, name: "Dashboard", text: "Arrivals, departures, rooms ready tonight, today's takings and the last handover note, on one calm screen." },
      { icon: CalendarPlus, name: "Reservations in under a minute", text: "Dates, room, guest and advance in four steps. Walk-in guests are checked in straight away." },
      { icon: CalendarDays, name: "Room calendar", text: "Every room, one or two weeks ahead. Tap an open night to reserve it." },
      { icon: DoorOpen, name: "One-tap arrivals and departures", text: "A gentle reminder if the room isn't clean yet or an adult's ID hasn't been checked." },
      { icon: Repeat, name: "Extend, move or cancel", text: "Stay extensions, room moves, early and late departures, cancellations, no-shows and undo check-in." },
      { icon: ShieldCheck, name: "Zero double bookings", text: "The same room can never be sold twice for the same night." },
    ],
  },
  {
    title: "Guests and ID",
    items: [
      { icon: Send, name: "Express check-in", text: "Send a link on WhatsApp and guests fill in their details, journey and every adult's name on their phone. You only choose the room." },
      { icon: UserCheck, name: "ID check at check-in", text: "Tick each adult's original ID at the desk, with who checked it and when. Nothing from an Aadhaar is ever saved." },
      { icon: Printer, name: "Registration card", text: "A card for every stay with each adult and the ID they showed, ready to sign. Form C details for foreign guests are written on it by hand." },
      { icon: IdCard, name: "Pathik filled in for you", text: "For hotels in Gujarat, a Chrome helper fills Pathik's Add Guest form with every adult, and the Dashboard shows who is still to enter." },
      { icon: Star, name: "Guest history and VIP flags", text: "Every stay and payment on record, returning guests recognised by phone, and VIP or “do not allow” flags." },
      { icon: MessageSquareText, name: "WhatsApp messages in your words", text: "Booking confirmation, welcome at check-in and thank-you at check-out, ready to send in one tap." },
    ],
  },
  {
    title: "Billing, payments and GST",
    items: [
      { icon: Receipt, name: "Guest bills that total themselves", text: "Room nights, weekend and festival prices, discounts and taxes, always correct." },
      { icon: UtensilsCrossed, name: "Food, laundry and extras", text: "Food, laundry, minibar, taxi, extra bed or damage, added to the bill with the right tax." },
      { icon: Wallet, name: "Advances, part payments and refunds", text: "Cash, UPI, card, bank transfer or prepaid on a booking site, with the balance always clear." },
      { icon: FileText, name: "Polished GST invoices", text: "Your GSTIN and the guest's, CGST and SGST, SAC codes and the amount in words. Print or save as PDF." },
      { icon: FilePenLine, name: "Bill changes done right", text: "Agreed a lower rate at check-out? Edit the bill and any extra paid is recorded as given back. Reports show the first and final totals." },
      { icon: Tags, name: "Your rates, your rules", text: "Weekend and festival prices, GST slabs or one flat rate, which staff can change for a single booking." },
    ],
  },
  {
    title: "Staff and shifts",
    items: [
      { icon: Clock, name: "Shifts with a handover", text: "Staff read the last handover note before they start, and end with a note for the next person." },
      { icon: MessageCircle, name: "Shift report on your WhatsApp", text: "Check-ins, check-outs, new bookings and money by method, sent to the owner at the end of every shift." },
      { icon: IndianRupee, name: "Cash drawer count", text: "Cash received minus cash spent on expenses: exactly what should be in the drawer." },
      { icon: Users, name: "Attendance and staff report", text: "Hours, check-ins, check-outs and money per person, with one Excel row for every shift." },
      { icon: UserCog, name: "Role-based staff access", text: "Front desk staff can't see reports, change rates or delete payments." },
      { icon: History, name: "Complete audit trail", text: "Every booking, payment and change, with who made it and when." },
    ],
  },
  {
    title: "Owner control and revenue",
    items: [
      { icon: BarChart3, name: "Profit reports", text: "Profit, occupancy, ADR, RevPAR and GOPPAR for any day, week, month or year, by room type and booking source, ready for Excel." },
      { icon: Banknote, name: "Expense tracker", text: "Salaries, electricity, supplies and repairs, written down as you pay them." },
      { icon: TrendingDown, name: "Rate tips for empty rooms", text: "Later in the day, a lower price for rooms likely to stay empty, from your own booking history and never below your lowest price." },
      { icon: Landmark, name: "Booking-site payouts", text: "Commission, GST, TCS and TDS from MakeMyTrip, Goibibo, Booking.com and others, and which payouts have reached your bank." },
      { icon: Sparkles, name: "Housekeeping board", text: "Rooms queued for cleaning at check-out, today's arrivals first, and rooms under maintenance kept off sale." },
      { icon: Globe, name: "Your own booking website", text: "Guests book you directly from their phone, with no commission." },
    ],
  },
];

const SPOTLIGHTS = [
  {
    image: "/welcome/dashboard.webp",
    eyebrow: "Dashboard",
    title: "Your whole property, the moment you sign in",
    text: "The Dashboard lists who is arriving and departing, with clear Check in and Check out buttons. Below, a box for every room shows who is in tonight, which rooms are free and ready, and which still need cleaning, with today's takings at the top.",
    points: ["Arrivals and departures, one tap each", "Every room at a glance", "Takings received and balances still due"],
  },
  {
    image: "/welcome/new-booking.webp",
    eyebrow: "New reservation",
    title: "Confirm a reservation before the call ends",
    text: "Four quick steps: dates, an available room, the guest's details and the advance. Every available room shows its full price, so you can quote with confidence.",
    points: ["Quick picks for 1, 2, 3 or 7 nights", "Returning guests recognised by phone number", "Confirmation sent on WhatsApp in one tap"],
  },
  {
    image: "/welcome/calendar.webp",
    eyebrow: "Room calendar",
    title: "Every room, every night, at a glance",
    text: "Each room is a row and each day a column. Coloured bars show upcoming, in-house and departed guests. Tap any open night to reserve that room.",
    points: ["Availability for every day", "Rooms under maintenance blocked off", "Rooms awaiting housekeeping marked"],
  },
  {
    image: "/welcome/booking.webp",
    eyebrow: "Guest bill",
    title: "A guest bill that's always right",
    text: "Room nights, weekend and festive rates, discounts, dining and laundry are all added with the correct tax. Take payments as they come, and the balance is always clear.",
    points: ["Extras added from the front desk", "Advances, part payments and refunds", "Extend the stay or move rooms anytime"],
  },
  {
    image: "/welcome/invoice.webp",
    eyebrow: "GST invoice",
    title: "Invoices worthy of your brand",
    text: "A proper GST tax invoice with your GSTIN and the guest's, SAC codes, CGST and SGST, and the amount in words. The GST slab is chosen automatically from the room rate.",
    points: ["Print or save as PDF", "Booking confirmation and registration card too", "GST invoice list ready for Excel"],
  },
  {
    image: "/welcome/housekeeping.webp",
    eyebrow: "Housekeeping",
    title: "Every room ready before the guest is",
    text: "When a guest checks out, the room moves to Needs cleaning, with rooms for today's arrivals at the top. Staff tap Start cleaning and Mark clean from any phone.",
    points: ["Assign a housekeeper and leave a note", "Today's arrivals prepared first", "Front desk sees the moment a room is ready"],
  },
  {
    image: "/welcome/expenses.webp",
    eyebrow: "Expenses",
    title: "Every rupee you spend, in one place",
    text: "Salaries, electricity, supplies, repairs and commission, written down in seconds. Front desk can add petty cash; the owner sees every cost, by kind.",
    points: ["Twelve kinds of cost, with notes and bill numbers", "Cash spent is taken off the cash drawer count", "Salaries stay private to the owner"],
  },
  {
    image: "/welcome/reports.webp",
    eyebrow: "Profit reports",
    title: "Know your profit, and what every room earns",
    text: "Pick a day, week, month or year and see earnings minus expenses, how full you were, the average price per room sold, and what each available room earns and costs you (RevPAR). Front desk staff never see these figures.",
    points: ["Profit after every expense", "RevPAR and cost per available room", "Print, save as PDF or download for Excel"],
  },
];

const STEPS = [
  { title: "We set up your property", text: "We prepare your account and send your sign-in and booking website link on WhatsApp." },
  { title: "Add your rooms and rates", text: "A short guided checklist on the first screen. It takes about 10 minutes." },
  { title: "Welcome your first guests", text: "Invite your team, share your booking link and run the front desk from any device." },
];

type Cell = boolean | string;
const COMPARISON: Array<{ row: string; paper: Cell; typical: Cell; ours: Cell }> = [
  { row: "New staff confident in one shift", paper: true, typical: "Often needs training", ours: true },
  { row: "Clear, everyday language", paper: true, typical: false, ours: true },
  { row: "Zero double bookings", paper: false, typical: true, ours: true },
  { row: "Guest details sent ahead on WhatsApp", paper: false, typical: "Rarely", ours: true },
  { row: "Shift handover and staff reports", paper: false, typical: "Sometimes", ours: "Included" },
  { row: "Polished GST invoice in one tap", paper: false, typical: true, ours: true },
  { row: "Runs fully on a phone or tablet", paper: false, typical: "Sometimes", ours: true },
  { row: "Your own commission-free booking website", paper: false, typical: "Often extra cost", ours: "Included" },
  { row: "Revenue and occupancy from anywhere", paper: false, typical: true, ours: true },
  { row: "Profit after expenses, per room", paper: false, typical: "Often extra cost", ours: "Included" },
];

const FAQS = [
  {
    q: "Do we need special hardware?",
    a: "No. It runs in the browser on any phone, tablet or computer. Many properties run the front desk on a tablet while owners review the numbers on their phone.",
  },
  {
    q: "How quickly can our team learn it?",
    a: "Most front desk staff are confident within one shift. The screens use clear words like “Guest arrived” and “Did not come”, every menu item has a hint, and a step-by-step guide is built in.",
  },
  {
    q: "How do we stay in control of staff?",
    a: "Each team member has their own sign-in. Front desk staff can't see reports, change rates or delete payments, and every booking, payment and change is recorded with their name.",
  },
  {
    q: "How is guest data protected?",
    a: "Each property's data is kept completely separate. No ID numbers, copies or photos are stored, and nothing from an Aadhaar is saved: staff look at the original ID and tick which one they checked.",
  },
  {
    q: "Does it handle GST?",
    a: "Yes. It picks the GST slab from the room rate automatically (you can change the slabs, use one flat rate, or change it for a single booking), adds tax to extras, and prints tax invoices with CGST, SGST and SAC codes.",
  },
  {
    q: "Can I see my profit?",
    a: "Yes. Write down expenses as you pay them, and Reports show earnings minus expenses for any day, week, month or year, along with occupancy, the average price per room sold, and what each available room earns and costs you (RevPAR).",
  },
  {
    q: "Can guests send their details before they arrive?",
    a: "Yes. Send express check-in on WhatsApp. The guest fills in their address, journey, vehicle and every adult's name on their phone, and says which ID they will show at check-in. You get a pop-up, choose the room and the booking is ready.",
  },
  {
    q: "We are in Gujarat. Does it help with Pathik?",
    a: "Yes. A small Chrome helper fills Pathik's Add Guest form from the booking, every adult included. Staff type only the Aadhaar details, press Submit in Pathik, and the Dashboard shows who is still to enter.",
  },
  {
    q: "Can I see what each shift did?",
    a: "Yes. Every shift ends with a handover note and a report of check-ins, check-outs and money taken, sent to your WhatsApp. Staff shifts shows attendance and hours per person, with a staff report for Excel.",
  },
  {
    q: "What about international guests?",
    a: "Print a guest registration card with a Form C box to fill in by hand. Passport and visa numbers are not stored in the software, so they stay with your hotel.",
  },
  {
    q: "Does it connect to Booking.com, MakeMyTrip or Airbnb?",
    a: "Not automatically yet. Bookings from those sites are added in a few taps and tagged by source, so your reports show which channels bring you the most guests. Booking-site payouts tracks the commission, TCS and TDS each site takes and which payouts have reached your bank.",
  },
  {
    q: "Can guests pay online?",
    a: "Yes. Send a payment link on WhatsApp for the full bill or an advance. Guests pay by UPI straight to your own account (QR code, no charges), or by UPI, card or net banking through your own Razorpay account, which marks the booking as paid by itself. Bills with money still due print a UPI QR code too.",
  },
  {
    q: "Can we book several rooms for one family or group?",
    a: "Yes. Tap every room in one booking: same guest and dates, the same special price if you agree one, and one advance shared over the rooms. Each room keeps its own bill and GST invoice, and the group has one page, one payment button and a group bill.",
  },
  {
    q: "Does it work with Tally?",
    a: "Yes. Reports make two files for TallyPrime: the ledgers, then the period's GST invoices as Sales vouchers and every payment and refund as Receipt and Payment vouchers. Your accountant imports them in two steps, with your own ledger names.",
  },
  {
    q: "Do we need internet?",
    a: "Yes, any standard mobile data or WiFi connection is enough.",
  },
  {
    q: "What does it cost?",
    a: "A monthly fee per property, with no commission on your bookings. Message us for a quote.",
  },
];

function ContactButtons({ dark = false }: { dark?: boolean }) {
  if (!whatsappHref && !emailHref) {
    return (
      <PlayTourButton className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-600 px-6 text-base font-bold text-white hover:bg-primary-700">
        <Play className="h-5 w-5" fill="currentColor" /> Watch the 2-minute tour
      </PlayTourButton>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-bold text-white shadow-lg hover:bg-emerald-700"
        >
          <MessageCircle className="h-5 w-5" /> Talk to us on WhatsApp
        </a>
      )}
      {emailHref && (
        <a
          href={emailHref}
          className={
            "inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-6 text-base font-bold " +
            (dark ? "bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20" : "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50")
          }
        >
          <Mail className="h-5 w-5 shrink-0" /> <span className="truncate">{salesEmail}</span>
        </a>
      )}
    </div>
  );
}

function BrowserFrame({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      <Image src={src} alt={alt} width={1600} height={1000} sizes="(min-width: 1024px) 640px, 100vw" priority={priority} className="h-auto w-full" />
    </div>
  );
}

function PhoneFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={"overflow-hidden rounded-[2.2rem] border-[9px] border-slate-900 bg-white shadow-2xl " + className}>
      <Image src={src} alt={alt} width={780} height={1688} sizes="260px" className="h-auto w-full" />
    </div>
  );
}

function CellValue({ value, highlight = false, compact = false }: { value: Cell; highlight?: boolean; compact?: boolean }) {
  if (value === true) return <Check className={"mx-auto h-5 w-5 " + (highlight ? "text-primary-600" : "text-emerald-600")} strokeWidth={2.5} aria-label="Yes" />;
  if (value === false) return <X className="mx-auto h-5 w-5 text-slate-300" aria-label="No" />;
  return <span className={(compact ? "text-xs leading-snug " : "text-sm ") + (highlight ? "font-semibold text-primary-700" : "text-slate-500")}>{value}</span>;
}

export default function WelcomePage() {
  return (
    <div className={`${display.variable} min-h-screen bg-white text-slate-900`}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center">
            <Logo markClassName="h-8 w-8" wordClassName="text-2xl" />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-[15px] font-medium text-slate-600 md:flex" aria-label="Page sections">
            <a href="#tour" className="hover:text-slate-900">
              Video tour
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#website" className="hover:text-slate-900">
              Booking website
            </a>
            <a href="#questions" className="hover:text-slate-900">
              Questions
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-lg bg-primary-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-700 sm:inline-flex"
              >
                Request a demo
              </a>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-50">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pb-24 lg:pt-20">
            <div className="min-w-0">
              <p className="mb-4 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary-700 ring-1 ring-primary-200">
                For boutique hotels, resorts and premium stays
              </p>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Effortless operations for exceptional stays
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Reservations, express check-in on WhatsApp, guest bills, GST invoices, housekeeping, staff shifts and owner reports in one refined app, on
                any device. With your own
                booking website, guests book you directly and you keep the commission.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PlayTourButton className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-600 px-6 text-base font-bold text-white hover:bg-primary-700">
                  <Play className="h-5 w-5" fill="currentColor" /> Watch the 2-minute tour
                </PlayTourButton>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-bold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    <MessageCircle className="h-5 w-5 text-emerald-600" /> Request a demo
                  </a>
                )}
              </div>
              <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-[15px] text-slate-700">
                {["Zero double bookings", "Polished GST invoices", "Express check-in on WhatsApp", "Staff shifts & handover", "Profit & RevPAR reports", "Rate tips for empty rooms"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative min-w-0 pb-10 lg:pb-0">
              <BrowserFrame src="/welcome/dashboard.webp" alt="The Dashboard showing arrivals, departures and every room tonight" priority />
              <PhoneFrame
                src="/welcome/guest-site.webp"
                alt="The hotel's own booking website on a phone"
                className="absolute -bottom-2 -left-3 hidden w-[150px] sm:block lg:-bottom-10 lg:-left-10 lg:w-[180px]"
              />
            </div>
          </div>
        </section>

        {/* Video tour */}
        <section id="tour" className="scroll-mt-16 bg-slate-950 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-primary-300">Video tour</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">A few highlights, in under 2 minutes</h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-300">
              A guest books direct, the desk sends express check-in on WhatsApp, checks guests in and out, and the GST invoice is ready. Then the day
              sheet for when the internet goes, installing Innvela like desktop software, and the owner&rsquo;s profit. There is much more: ask us for a demo
              to see all of it. Tap a chapter to jump to it.
            </p>
            <div className="mt-10">
              <TourPlayer />
            </div>
          </div>
        </section>

        {/* All features */}
        <section id="features" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-primary-600">One refined system</p>
            <h2 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Everything a premium hotel needs, without the complexity
            </h2>
            <div className="mt-12 grid gap-12">
              {FEATURE_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-5 border-b border-slate-200 pb-3 font-display text-xl font-bold">{group.title}</h3>
                  <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((f) => {
                      const Icon = f.icon;
                      return (
                        <li key={f.name} className="flex gap-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900">{f.name}</span>
                            <span className="block text-[15px] leading-relaxed text-slate-600">{f.text}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature spotlights */}
        <section className="bg-slate-50 py-16 sm:py-24" aria-label="A closer look">
          <div className="mx-auto grid max-w-6xl gap-20 px-4 sm:px-6 lg:gap-28">
            {SPOTLIGHTS.map((s, i) => (
              <div key={s.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={"min-w-0 " + (i % 2 === 1 ? "lg:order-2" : "")}>
                  <BrowserFrame src={s.image} alt={s.title} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary-600">{s.eyebrow}</p>
                  <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">{s.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-slate-600">{s.text}</p>
                  <ul className="mt-5 grid gap-2.5">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Guest booking website */}
        <section id="website" className="scroll-mt-16 overflow-hidden py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary-600">Your booking website</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Direct bookings, without the commission</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Every property gets its own booking page. Share it on Instagram, WhatsApp, Google Maps and your website. Guests choose their dates, see
                live rates and book from their phone, and the reservation appears in your app instantly.
              </p>
              <ul className="mt-6 grid gap-3">
                {[
                  { icon: Smartphone, text: "Designed for phones, where most guests book" },
                  { icon: BedDouble, text: "Live rates and availability, with your amenities and policies" },
                  { icon: UserCheck, text: "Booking reference and confirmation page for the guest" },
                  { icon: MessageCircle, text: "Call and WhatsApp buttons so guests can reach you directly" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-[15px] text-slate-700">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <PhoneFrame src="/welcome/guest-site.webp" alt="Available rooms with prices on the hotel's booking website" className="w-[260px] sm:w-[290px]" />
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section className="bg-primary-600 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Live at your property the same day</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/20">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-display text-lg font-bold text-primary-700">{i + 1}</span>
                  <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-primary-100">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Why premium properties switch</h2>
            <p className="mt-3 text-lg text-slate-600">The polish your guests expect, with the simplicity your team needs.</p>
            {/* Phones: one card per feature, with the three columns named once in a header that stays in view. */}
            <div className="mt-8 sm:hidden">
              <div className="sticky top-14 z-10 grid grid-cols-3 gap-2 rounded-t-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs font-semibold leading-tight text-slate-600 shadow-sm">
                <span>Register or Excel</span>
                <span>Other software</span>
                <span className="rounded-lg bg-primary-600 py-1 font-bold text-white">Innvela</span>
              </div>
              <ul className="rounded-b-2xl border-x border-b border-slate-200">
                {COMPARISON.map((r) => (
                  <li key={r.row} className="border-t border-slate-200 px-3 py-3 first:border-t-0">
                    <p className="text-[15px] font-semibold text-slate-800">{r.row}</p>
                    <div className="mt-2 grid grid-cols-3 items-center gap-2 text-center">
                      <CellValue value={r.paper} compact />
                      <CellValue value={r.typical} compact />
                      <div className="flex min-h-9 items-center justify-center rounded-lg bg-primary-50 px-1 py-1.5 ring-1 ring-primary-100">
                        <CellValue value={r.ours} highlight compact />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tablets and computers: the full table. */}
            <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-slate-200 shadow-sm sm:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 text-sm text-slate-600">
                    <th className="w-[40%] px-5 py-4 font-semibold" scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="w-[20%] px-4 py-4 text-center font-semibold" scope="col">
                      Register or Excel
                    </th>
                    <th className="w-[20%] px-4 py-4 text-center font-semibold" scope="col">
                      Typical hotel software
                    </th>
                    <th className="w-[20%] bg-primary-600 px-4 py-4 text-center text-base font-bold text-white" scope="col">
                      Innvela
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((r) => (
                    <tr key={r.row} className="border-t border-slate-200 transition-colors hover:bg-slate-50/70">
                      <th scope="row" className="px-5 py-3.5 text-[15px] font-medium text-slate-800">
                        {r.row}
                      </th>
                      <td className="px-4 py-3.5 text-center">
                        <CellValue value={r.paper} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <CellValue value={r.typical} />
                      </td>
                      <td className="border-x border-primary-100 bg-primary-50 px-4 py-3.5 text-center">
                        <CellValue value={r.ours} highlight />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-12 font-display text-xl font-bold">Made for hotels in India</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { k: "GST", v: "Slabs, CGST/SGST, SAC codes" },
                { k: "Pathik", v: "Gujarat's police guest register, filled in for you" },
                { k: "Form C", v: "Registration card for foreign guests" },
                { k: "UPI + WhatsApp", v: "How your guests already pay and stay in touch" },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="font-display text-xl font-bold text-primary-700">{x.k}</p>
                  <p className="mt-1 text-[15px] text-slate-600">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="questions" className="scroll-mt-16 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions owners ask</h2>
            <div className="mt-8 grid gap-3">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-2xl bg-white ring-1 ring-slate-200 open:ring-primary-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-semibold">
                    {f.q}
                    <span className="text-2xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="bg-slate-950 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">Give your front desk the polish your guests expect</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              {whatsappHref || emailHref
                ? "Message us for a private demo. We'll set up your property, add your rooms with you and send your sign-in the same day."
                : "Watch the 2-minute tour for a few highlights, from the first booking to the owner's profit."}
            </p>
            <div className="mt-8">
              <ContactButtons dark />
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Already using Innvela?{" "}
              <Link href="/login" className="font-semibold text-white underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <LogoMark className="h-5 w-5" /> Innvela · Hotel software for boutique and premium hotels
          </p>
          <div className="flex gap-5">
            <a href="#tour" className="hover:text-slate-900">
              Video tour
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <Link href="/login" className="hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
