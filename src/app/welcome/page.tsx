import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import {
  BarChart3,
  BedDouble,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  ClipboardCheck,
  DoorOpen,
  FileDown,
  FileText,
  Globe,
  History,
  Hotel,
  IndianRupee,
  Mail,
  MessageCircle,
  Play,
  Receipt,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tags,
  UserCheck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { PlayTourButton, TourPlayer } from "./tour";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { absolute: "Hotel Manager · Simple hotel software for small hotels" },
  description:
    "Bookings, check-in, GST invoices, housekeeping, reports and your own booking website. Hotel software your front desk can learn in one shift.",
  openGraph: {
    title: "Hotel Manager · Simple hotel software for small hotels",
    description: "Bookings, check-in, GST invoices, housekeeping, reports and your own booking website, in one simple app.",
    images: [{ url: "/welcome/og-image.jpg", width: 1280, height: 720 }],
  },
};

// Optional contact details shown on the page, set in the hosting settings (see docs/hosting.md).
const salesWhatsapp = (process.env.SALES_WHATSAPP || "").replace(/[^\d]/g, "");
const salesEmail = (process.env.SALES_EMAIL || "").trim();
const whatsappHref = salesWhatsapp
  ? `https://wa.me/${salesWhatsapp}?text=${encodeURIComponent("Hello, I'd like to know more about Hotel Manager for my hotel.")}`
  : null;
const emailHref = salesEmail ? `mailto:${salesEmail}?subject=${encodeURIComponent("Hotel Manager for my hotel")}` : null;

const FEATURE_GROUPS = [
  {
    title: "Front desk",
    items: [
      { icon: ClipboardCheck, name: "Today screen", text: "Arrivals, departures, free rooms and today's money, all on one screen." },
      { icon: CalendarPlus, name: "Bookings in under a minute", text: "Dates, room, guest name and phone. Walk-ins are checked in straight away." },
      { icon: CalendarDays, name: "Room calendar", text: "Every room for the next two weeks. Tap a free day to book it." },
      { icon: DoorOpen, name: "One-tap check-in and check-out", text: "Reminders when a room isn't clean or the ID proof is missing." },
      { icon: Repeat, name: "Extend, move or cancel", text: "Change dates, move rooms, early check-outs, cancellations and no-shows." },
      { icon: ShieldCheck, name: "No double bookings", text: "Two people can never book the same room for the same night." },
    ],
  },
  {
    title: "Bills, payments and GST",
    items: [
      { icon: Receipt, name: "Bills that add themselves up", text: "Room nights, weekend and festival prices, discounts and taxes." },
      { icon: UtensilsCrossed, name: "Food, laundry and extras", text: "Add anything the guest orders to their bill, with the right tax." },
      { icon: Wallet, name: "Advance, part payments and refunds", text: "Cash, UPI, card or bank transfer, with the balance always shown." },
      { icon: FileText, name: "GST tax invoice", text: "Hotel and guest GSTIN, CGST and SGST, SAC codes and the amount in words." },
      { icon: IndianRupee, name: "Cash drawer totals", text: "Today's money split by cash, UPI and card at the end of every shift." },
      { icon: Tags, name: "Your prices, your rules", text: "Automatic GST slabs, weekend prices and special prices for festivals." },
    ],
  },
  {
    title: "Guests",
    items: [
      { icon: Users, name: "Guest records", text: "Every stay, night and payment. Returning guests are found by phone number." },
      { icon: Camera, name: "ID proof from the phone camera", text: "Take a photo of Aadhaar, passport or licence and keep it with the guest." },
      { icon: Globe, name: "Foreign guests", text: "Registration card with passport and visa details to help with Form C." },
      { icon: MessageCircle, name: "WhatsApp in one tap", text: "Send booking confirmations and bill details with the message ready." },
      { icon: Star, name: "VIP and “do not allow”", text: "Flags that warn staff about special or unwanted guests." },
      { icon: FileDown, name: "Print or save as PDF", text: "Invoices, booking confirmations and registration cards." },
    ],
  },
  {
    title: "Running the hotel",
    items: [
      { icon: Sparkles, name: "Housekeeping board", text: "Rooms are marked for cleaning at check-out. Rooms with arrivals come first." },
      { icon: BarChart3, name: "Owner reports", text: "How full you were, average room price, earnings and who still owes money." },
      { icon: FileDown, name: "Downloads for Excel", text: "Bookings, payments and GST invoices for your accountant." },
      { icon: UserCog, name: "Staff sign-ins", text: "Front desk can't see reports, change prices or delete payments." },
      { icon: History, name: "Activity history", text: "Every booking, payment and change, with who did it and when." },
      { icon: Globe, name: "Your own booking website", text: "Guests book you directly from their phone. No commission." },
    ],
  },
];

const SPOTLIGHTS = [
  {
    image: "/welcome/today.webp",
    eyebrow: "Today screen",
    title: "Know what to do the moment you open it",
    text: "The Today screen lists who is arriving and who is leaving, with big Check in and Check out buttons. It also shows which rooms are free tonight, which need cleaning, and how much money came in today.",
    points: ["Arrivals and departures with one-tap buttons", "Colour-coded board of every room", "Money received and money still to collect"],
  },
  {
    image: "/welcome/new-booking.webp",
    eyebrow: "New booking",
    title: "Take a booking while the guest is still on the phone",
    text: "Four simple steps: dates, a free room, the guest's name and phone, then the advance. Every free room shows its total price, so you can quote straight away.",
    points: ["Quick buttons for 1, 2, 3 or 7 nights", "Returning guests found by phone number", "Confirmation sent on WhatsApp in one tap"],
  },
  {
    image: "/welcome/calendar.webp",
    eyebrow: "Room calendar",
    title: "See every room at a glance",
    text: "Each room is a row and each day is a column. Coloured bars show who is booked, who is staying and who has left. Tap any empty box to book that room for that day.",
    points: ["How many rooms are free each day", "Rooms under repair are blocked", "Rooms that need cleaning are marked"],
  },
  {
    image: "/welcome/booking.webp",
    eyebrow: "Guest bill",
    title: "A bill that adds itself up",
    text: "Room nights, weekend and festival prices, discounts, food and laundry are all added with the right tax. Take payments as they come and always see what is still to pay.",
    points: ["Extras added from the front desk", "Advance, part payments and refunds", "Extend the stay or move rooms anytime"],
  },
  {
    image: "/welcome/invoice.webp",
    eyebrow: "GST invoice",
    title: "GST invoices your accountant will like",
    text: "A proper tax invoice with your GSTIN and the guest's, SAC codes, CGST and SGST, and the amount in words. GST slabs are picked automatically from the room price.",
    points: ["Print or save as PDF", "Booking confirmation and registration card too", "GST invoice list ready for Excel"],
  },
  {
    image: "/welcome/housekeeping.webp",
    eyebrow: "Housekeeping",
    title: "Rooms ready on time",
    text: "When a guest checks out, the room moves to Needs cleaning. Rooms with guests arriving today come first. Cleaners tap Start cleaning and Mark clean from their own phone.",
    points: ["Assign a cleaner and leave a note", "Arrivals today shown first", "Front desk sees which rooms are ready"],
  },
  {
    image: "/welcome/reports.webp",
    eyebrow: "Owner reports",
    title: "See how your hotel is really doing",
    text: "Owners see occupancy, room earnings, average price per night, money received and money owed, from anywhere. Front desk staff don't see these numbers.",
    points: ["Where bookings came from and how guests paid", "GST summary for any period", "Download everything for Excel"],
  },
];

const STEPS = [
  { title: "We set up your hotel", text: "You get your own sign-in and your booking website link on WhatsApp." },
  { title: "Add your rooms and prices", text: "A short checklist on the first screen guides you. It takes about 10 minutes." },
  { title: "Start taking bookings", text: "Add your staff, share your booking link, and run the front desk from any phone." },
];

type Cell = boolean | string;
const COMPARISON: Array<{ row: string; paper: Cell; typical: Cell; ours: Cell }> = [
  { row: "Staff can learn it in one shift", paper: true, typical: "Often needs training", ours: true },
  { row: "Plain words, no hotel jargon", paper: true, typical: false, ours: true },
  { row: "Stops double bookings", paper: false, typical: true, ours: true },
  { row: "GST invoice in one tap", paper: false, typical: true, ours: true },
  { row: "Works fully on a phone", paper: false, typical: "Sometimes", ours: true },
  { row: "Your own booking website", paper: false, typical: "Often extra cost", ours: "Included" },
  { row: "See money and occupancy from anywhere", paper: false, typical: true, ours: true },
];

const FAQS = [
  {
    q: "Do I need a computer?",
    a: "No. It works in the browser on any phone, tablet or computer. Many hotels run the front desk on a phone and look at reports on a computer.",
  },
  {
    q: "How long does it take my staff to learn?",
    a: "Most front-desk staff learn the basics in one shift. The screens use plain words like “Guest arrived” and “Did not come”, every menu item has a hint, and a step-by-step help guide is built in.",
  },
  {
    q: "Can my staff misuse it?",
    a: "Each person gets their own sign-in. Front-desk staff can't see reports, change prices or delete payments, and every booking, payment and change is recorded with their name.",
  },
  {
    q: "Is my data private?",
    a: "Each hotel's data is kept completely separate, and guest ID photos can only be opened by your signed-in staff.",
  },
  {
    q: "Does it handle GST?",
    a: "Yes. It picks the GST slab from the room price automatically (you can change the slabs), adds tax to food and extras, and prints tax invoices with CGST, SGST and SAC codes.",
  },
  {
    q: "What about foreign guests?",
    a: "Save their passport and visa details and print a guest registration card with the fields you need for Form C.",
  },
  {
    q: "Does it connect to Booking.com, MakeMyTrip or Airbnb?",
    a: "Not automatically yet. You add those bookings in a few taps and mark where they came from, so reports show which website sends you the most guests.",
  },
  {
    q: "Can guests pay online?",
    a: "Not yet. Guests pay at the hotel by cash, UPI or card, and you record the payment in one tap. Your booking website shows “pay at hotel”.",
  },
  {
    q: "Do I need internet?",
    a: "Yes, a normal mobile data or WiFi connection is enough.",
  },
  {
    q: "What does it cost?",
    a: "A simple monthly fee per hotel, with no commission on your bookings. Message us for your price.",
  },
];

function ContactButtons({ dark = false }: { dark?: boolean }) {
  if (!whatsappHref && !emailHref) {
    return (
      <PlayTourButton className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary-600 px-6 text-base font-bold text-white shadow-lg hover:bg-primary-700">
        <Play className="h-5 w-5" fill="currentColor" /> Watch the 3-minute tour
      </PlayTourButton>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-bold text-white shadow-lg hover:bg-emerald-700"
        >
          <MessageCircle className="h-5 w-5" /> Talk to us on WhatsApp
        </a>
      )}
      {emailHref && (
        <a
          href={emailHref}
          className={
            "inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-base font-bold " +
            (dark ? "bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20" : "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50")
          }
        >
          <Mail className="h-5 w-5" /> {salesEmail}
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

function CellValue({ value, highlight = false }: { value: Cell; highlight?: boolean }) {
  if (value === true) return <Check className={"mx-auto h-5 w-5 " + (highlight ? "text-primary-600" : "text-emerald-600")} aria-label="Yes" />;
  if (value === false) return <X className="mx-auto h-5 w-5 text-slate-300" aria-label="No" />;
  return <span className={"text-sm " + (highlight ? "font-semibold text-primary-700" : "text-slate-500")}>{value}</span>;
}

export default function WelcomePage() {
  return (
    <div className={`${display.variable} min-h-screen bg-white text-slate-900`}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="rounded-xl bg-primary-600 p-2 text-white">
              <Hotel className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold">Hotel Manager</span>
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
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-xl bg-primary-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-700 sm:inline-flex"
              >
                Get it for your hotel
              </a>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pb-24 lg:pt-20">
            <div className="min-w-0">
              <p className="mb-4 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary-700 ring-1 ring-primary-200">
                For small hotels, guest houses and homestays
              </p>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Hotel software your front desk can learn in one shift
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Bookings, check-in and check-out, GST bills, housekeeping and reports in one simple app that works on any phone. Plus your own booking
                website, with no commission.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PlayTourButton className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary-600 px-6 text-base font-bold text-white shadow-lg hover:bg-primary-700">
                  <Play className="h-5 w-5" fill="currentColor" /> Watch the 3-minute tour
                </PlayTourButton>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 text-base font-bold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    <MessageCircle className="h-5 w-5 text-emerald-600" /> Talk to us
                  </a>
                )}
              </div>
              <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-[15px] text-slate-700">
                {["No double bookings", "GST tax invoices", "Works on any phone", "WhatsApp ready"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative min-w-0 pb-10 lg:pb-0">
              <BrowserFrame src="/welcome/today.webp" alt="The Today screen showing arrivals, departures and room status" priority />
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
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-300">Video tour</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">See a full day at a hotel in under 3 minutes</h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-300">
              A guest books online, the front desk checks guests in and out, the bill and GST invoice are made, rooms are cleaned and the owner checks
              the numbers. Tap a chapter to jump to it.
            </p>
            <div className="mt-10">
              <TourPlayer />
            </div>
          </div>
        </section>

        {/* All features */}
        <section id="features" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Everything in one app</p>
            <h2 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Everything a small hotel needs, and nothing it doesn&apos;t
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
                  <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">{s.eyebrow}</p>
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
              <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Your booking website</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Guests book you directly, with no commission</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Every hotel gets its own booking page. Share the link on WhatsApp, Instagram, Google Maps and your visiting card. Guests pick their dates,
                see live prices and book from their phone. The booking appears in your app straight away.
              </p>
              <ul className="mt-6 grid gap-3">
                {[
                  { icon: Smartphone, text: "Made for phones, where most guests book" },
                  { icon: BedDouble, text: "Live prices and free rooms, with your facilities and policy" },
                  { icon: UserCheck, text: "Booking number and confirmation page for the guest" },
                  { icon: MessageCircle, text: "Call and WhatsApp buttons so guests can reach you" },
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
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Up and running the same day</h2>
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
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">Why hotels switch</h2>
            <p className="mt-3 text-lg text-slate-600">The ease of a paper register, with everything proper hotel software does.</p>
            <div className="mt-8 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 text-sm text-slate-600">
                    <th className="px-4 py-3 font-semibold" scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" scope="col">
                      Register or Excel
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" scope="col">
                      Typical hotel software
                    </th>
                    <th className="bg-primary-600 px-4 py-3 text-center font-bold text-white" scope="col">
                      Hotel Manager
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((r) => (
                    <tr key={r.row} className="border-t border-slate-200">
                      <th scope="row" className="px-4 py-3 text-[15px] font-medium text-slate-800">
                        {r.row}
                      </th>
                      <td className="px-4 py-3 text-center">
                        <CellValue value={r.paper} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CellValue value={r.typical} />
                      </td>
                      <td className="bg-primary-50 px-4 py-3 text-center">
                        <CellValue value={r.ours} highlight />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-12 font-display text-xl font-bold">Made for hotels in India</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { k: "GST", v: "Slabs, CGST/SGST, SAC codes" },
                { k: "Form C", v: "Registration card for foreign guests" },
                { k: "UPI + WhatsApp", v: "How your guests already pay and talk" },
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
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions hotel owners ask</h2>
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
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">Ready to run your hotel the easy way?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              {whatsappHref || emailHref
                ? "Send us a message and we'll set up your hotel, add your rooms with you and send your sign-in the same day."
                : "Watch the 3-minute tour to see a full day at a hotel, from the first booking to the owner's reports."}
            </p>
            <div className="mt-8 flex justify-center">
              <ContactButtons dark />
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Already using Hotel Manager?{" "}
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
            <Hotel className="h-4 w-4 text-primary-600" /> Hotel Manager · Simple hotel software for small hotels
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
