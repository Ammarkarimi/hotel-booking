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
  title: { absolute: "Hotel Manager · Hotel software for boutique and premium hotels" },
  description:
    "Reservations, arrivals, polished GST invoices, housekeeping, owner reports and your own commission-free booking website. Hotel software for boutique hotels, resorts and premium stays.",
  openGraph: {
    title: "Hotel Manager · Hotel software for boutique and premium hotels",
    description: "Effortless front desk software for boutique hotels, resorts and premium stays, with your own commission-free booking website.",
    images: [{ url: "/welcome/og-image.jpg", width: 1280, height: 720 }],
  },
};

// Optional contact details shown on the page, set in the hosting settings (see docs/hosting.md).
const salesWhatsapp = (process.env.SALES_WHATSAPP || "").replace(/[^\d]/g, "");
const salesEmail = (process.env.SALES_EMAIL || "").trim();
const whatsappHref = salesWhatsapp
  ? `https://wa.me/${salesWhatsapp}?text=${encodeURIComponent("Hello, I'd like a demo of Hotel Manager for my property.")}`
  : null;
const emailHref = salesEmail ? `mailto:${salesEmail}?subject=${encodeURIComponent("Hotel Manager demo for my property")}` : null;

const FEATURE_GROUPS = [
  {
    title: "Front desk",
    items: [
      { icon: ClipboardCheck, name: "Today screen", text: "Every arrival, departure, ready room and today's takings, on one calm screen." },
      { icon: CalendarPlus, name: "Reservations in under a minute", text: "Dates, room and guest details. Walk-in guests are welcomed and checked in straight away." },
      { icon: CalendarDays, name: "Room calendar", text: "Every room, two weeks ahead. Tap an open night to reserve it." },
      { icon: DoorOpen, name: "One-tap arrivals and departures", text: "A gentle reminder if a room isn't ready or the guest's ID is missing." },
      { icon: Repeat, name: "Extend, move or cancel", text: "Stay extensions, room moves, early departures, cancellations and no-shows." },
      { icon: ShieldCheck, name: "Zero double bookings", text: "The same room can never be sold twice for the same night." },
    ],
  },
  {
    title: "Billing, payments and GST",
    items: [
      { icon: Receipt, name: "Guest bills that total themselves", text: "Room nights, weekend and festive rates, discounts and taxes, always correct." },
      { icon: UtensilsCrossed, name: "Dining, laundry and extras", text: "Add anything the guest enjoys to their bill, with the right tax." },
      { icon: Wallet, name: "Advances, part payments and refunds", text: "Cash, UPI, card or bank transfer, with the balance always clear." },
      { icon: FileText, name: "Polished GST invoices", text: "Your GSTIN and the guest's, CGST and SGST, SAC codes and the amount in words." },
      { icon: IndianRupee, name: "Shift cash-up", text: "Takings split by cash, UPI and card at the end of every shift." },
      { icon: Tags, name: "Your rates, your rules", text: "Weekend and festive rates, with GST slabs applied automatically." },
    ],
  },
  {
    title: "Guest experience",
    items: [
      { icon: Users, name: "Guest history", text: "Every stay and payment on record. Returning guests are recognised by their phone number." },
      { icon: Camera, name: "ID capture with the camera", text: "Photograph Aadhaar, passport or licence at the desk and keep it securely with the guest." },
      { icon: Globe, name: "International guests", text: "Registration cards with passport and visa details, ready for Form C." },
      { icon: MessageCircle, name: "WhatsApp in one tap", text: "Booking confirmations and bill details, sent with the message already written." },
      { icon: Star, name: "VIP and “do not allow” flags", text: "Staff know at a glance who deserves extra care, and who should not be admitted." },
      { icon: FileDown, name: "Print or save as PDF", text: "Invoices, confirmations and registration cards that look as good as your property." },
    ],
  },
  {
    title: "Owner control",
    items: [
      { icon: Sparkles, name: "Housekeeping board", text: "Rooms are queued for cleaning at check-out, with today's arrivals prepared first." },
      { icon: BarChart3, name: "Owner reports", text: "Occupancy, average room rate, revenue and outstanding balances, from anywhere." },
      { icon: FileDown, name: "Exports for your accountant", text: "Bookings, payments and GST invoices, ready for Excel." },
      { icon: UserCog, name: "Role-based staff access", text: "Front desk staff can't see reports, change rates or delete payments." },
      { icon: History, name: "Complete audit trail", text: "Every booking, payment and change, with who made it and when." },
      { icon: Globe, name: "Your own booking website", text: "Guests book you directly from their phone, with no commission." },
    ],
  },
];

const SPOTLIGHTS = [
  {
    image: "/welcome/today.webp",
    eyebrow: "Today screen",
    title: "Your whole property, the moment you sign in",
    text: "The Today screen shows who is arriving and departing, with clear Check in and Check out buttons. Alongside, you see which rooms are ready tonight, which are being cleaned and what has been collected today.",
    points: ["Arrivals and departures, one tap each", "Live colour-coded board of every room", "Takings received and balances still due"],
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
    text: "When a guest checks out, the room moves to Needs cleaning, with rooms for today's arrivals at the top. Housekeepers tap Start cleaning and Mark clean on their own phone.",
    points: ["Assign a housekeeper and leave a note", "Today's arrivals prepared first", "Front desk sees the moment a room is ready"],
  },
  {
    image: "/welcome/reports.webp",
    eyebrow: "Owner reports",
    title: "Your property's performance, wherever you are",
    text: "Owners see occupancy, room revenue, average rate per night, collections and balances due, from anywhere. Front desk staff never see these figures.",
    points: ["Booking sources and payment methods", "GST summary for any period", "Export everything to Excel"],
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
  { row: "Polished GST invoice in one tap", paper: false, typical: true, ours: true },
  { row: "Runs fully on a phone or tablet", paper: false, typical: "Sometimes", ours: true },
  { row: "Your own commission-free booking website", paper: false, typical: "Often extra cost", ours: "Included" },
  { row: "Revenue and occupancy from anywhere", paper: false, typical: true, ours: true },
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
    a: "Each property's data is kept completely separate, and guest ID photos can only be opened by your signed-in team.",
  },
  {
    q: "Does it handle GST?",
    a: "Yes. It picks the GST slab from the room rate automatically (you can change the slabs), adds tax to dining and extras, and prints tax invoices with CGST, SGST and SAC codes.",
  },
  {
    q: "What about international guests?",
    a: "Save their passport and visa details and print a guest registration card with the fields you need for Form C.",
  },
  {
    q: "Does it connect to Booking.com, MakeMyTrip or Airbnb?",
    a: "Not automatically yet. Bookings from those sites are added in a few taps and tagged by source, so your reports show which channels bring you the most guests.",
  },
  {
    q: "Can guests pay online?",
    a: "Not yet. Guests settle at the property by cash, UPI or card, and you record the payment in one tap. Your booking website shows “pay at hotel”.",
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
                Request a demo
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
                For boutique hotels, resorts and premium stays
              </p>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Effortless operations for exceptional stays
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Reservations, arrivals, guest bills, GST invoices, housekeeping and owner reports in one refined app, on any device. With your own
                booking website, guests book you directly and you keep the commission.
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
                    <MessageCircle className="h-5 w-5 text-emerald-600" /> Request a demo
                  </a>
                )}
              </div>
              <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-[15px] text-slate-700">
                {["Zero double bookings", "Polished GST invoices", "Owner view from anywhere", "WhatsApp guest updates"].map((t) => (
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
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">A day at a premium property, in under 3 minutes</h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-300">
              A guest books direct, the front desk welcomes them and checks them out, the bill and GST invoice come together, rooms are turned around and
              the owner reviews the numbers. Tap a chapter to jump to it.
            </p>
            <div className="mt-10">
              <TourPlayer />
            </div>
          </div>
        </section>

        {/* All features */}
        <section id="features" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">One refined system</p>
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
                : "Watch the 3-minute tour to see a full day at a premium property, from the first booking to the owner's reports."}
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
            <Hotel className="h-4 w-4 text-primary-600" /> Hotel Manager · Hotel software for boutique and premium hotels
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
