# Hotel Manager — simple hotel booking & front-desk software

A complete, easy-to-use system for small and independent hotels, guest houses
and homestays: bookings, a room calendar, check-in/check-out, guest records with
ID photos, billing with GST invoices, payments, housekeeping, owner reports,
staff accounts and a commission-free **online booking website** for guests.

It is designed for people with **no technical knowledge**: plain words instead
of hotel jargon, big buttons, one obvious next step on every screen, friendly
confirmations, and it works on a phone.

> Why these features? See [docs/RESEARCH.md](docs/RESEARCH.md) — a summary of
> what competitors (Cloudbeds, Little Hotelier, eZee, Hotelogix, RoomRaccoon…)
> offer and what small-hotel owners actually complain about and ask for.

## Features

| Area | What you can do |
|---|---|
| **Today screen** | Arrivals with one-tap *Check in*, departures with *Check out* and bill, colour-coded board of every room, money received today (by cash/UPI/card), money still to collect, rooms to clean, setup checklist, staff activity |
| **New booking wizard** | 4 steps: dates (quick “2 nights” buttons) → free rooms with total price → returning-guest search or new guest → price, discount, source, advance payment. **Walk-in** mode checks the guest in immediately. Confirmation via **WhatsApp** or print |
| **No double bookings** | Availability is date-based; the database locks a room while a booking is saved, so two people can never book the same room for the same night |
| **Room calendar** | Tape chart of all rooms for 7/14 days; tap an empty box to book that room from that date |
| **Booking page** | Live bill (room nights, weekend/festival prices, discount, extras, taxes), payments and refunds, extend stay, change dates, move room, early/late checkout, no-show, cancel, undo check-in |
| **Extras** | Add food, laundry, minibar, taxi, extra bed or damage charges to the guest’s bill |
| **Billing & GST** | Indian GST slabs (0% / 5% / 18% by nightly tariff, editable) or one flat tax rate; separate tax on extras; final invoice snapshot at checkout |
| **Printables** | GST tax invoice (GSTINs, SAC codes, CGST/SGST, amount in words), proforma bill, booking confirmation, guest registration card with Form C fields for foreign guests |
| **Guests** | Profiles with stays, nights, total paid and money owed; ID photo upload from the phone camera; passport/visa for foreigners; company & GSTIN; VIP and “do not allow” flags |
| **Housekeeping** | Needs cleaning / being cleaned / clean board; rooms become dirty automatically at checkout; rooms with guests arriving today shown first |
| **Payments** | Cash, UPI, card, bank transfer; refunds; daily cash-drawer totals |
| **Reports (owner)** | Occupancy, room earnings, ADR, RevPAR, money received and owed, daily charts, bookings by source, payment methods, room types, extras, GST summary, CSV downloads for Excel |
| **Prices** | Normal price per room, weekend price change %, special prices for date ranges (festivals, off-season), special agreed price per booking |
| **Online booking website** | `/book` — guests pick dates, see prices per room type and book (pay at hotel). Bookings appear marked “Our website”. Spam-protected |
| **Staff & security** | Owner/manager and front-desk roles (front desk can’t see reports, change settings or delete records), activity history of who did what, login rate limiting, disabled staff lose access immediately |
| **Help** | Built-in step-by-step guide written in plain words |

## Quick start (local)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
# 1. Start PostgreSQL (or use your own)
docker compose up -d

# 2. Configure
cp .env.example .env

# 3. Install, create the database tables and load demo data
npm install
npm run db:setup:dev     # migrations + demo hotel with rooms, guests and bookings
npm run dev
```

Open <http://localhost:3000> and sign in:

| Role | Email | Password |
|---|---|---|
| Owner / manager | `admin@hotel.com` | `admin123` |
| Front desk | `staff@hotel.com` | `staff123` |

The guest booking website is at <http://localhost:3000/book>.

**Change these passwords** after the first sign-in (*My account*, or *Settings → Staff*).

## Setting up a real hotel

1. Deploy (see below) and run `npm run db:seed` once — this creates only the two
   sign-in accounts, no demo data.
2. Sign in as the owner. The **Getting started** checklist on the Today screen
   walks you through:
   - *Settings → Hotel details*: name, address, phone, GSTIN, check-in/out times
   - *Rooms → Add room*: each room with type, normal price and facilities
   - *Settings → Prices & tax*: GST slabs or flat tax, weekend and festival prices
   - *Settings → Staff*: one sign-in per staff member
   - *Settings → Online booking*: copy your booking link and share it

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Production | Secret for sign-in sessions. Generate with `openssl rand -base64 32` |
| `STORAGE_DRIVER` | No | `local` (default) or `blob`. Auto-selects `blob` when `BLOB_READ_WRITE_TOKEN` is set |
| `UPLOAD_DIR` | No | Folder for ID uploads when `STORAGE_DRIVER=local` (default `./uploads`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Vercel Blob token for ID uploads |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` shows the demo sign-in accounts on the login page in production |

## Deploying (Vercel + Neon)

1. Push to GitHub and import the repository at [vercel.com/new](https://vercel.com/new).
2. **Storage → Create → Neon** (Postgres) and connect it to the project; this sets `DATABASE_URL`.
3. **Storage → Create → Blob** and connect it; this sets `BLOB_READ_WRITE_TOKEN` (for ID photos).
4. Add `JWT_SECRET` under *Settings → Environment Variables*.
5. Deploy. The build runs `prisma generate → prisma migrate deploy → next build`.
6. Once, from your computer: `DATABASE_URL="<production url>" npm run db:seed`.

Any Node host with PostgreSQL works (Railway, Render, a VPS): set the variables,
run `npm run build` and `npm start`. For local file storage, keep `./uploads` on a
persistent disk.

### Upgrading an existing installation

The migration `20261008000000_hotel_suite` upgrades databases from the earlier
“Hotel Billing Manager” version in place: existing rooms, guests, bookings,
payments and bills are kept, bookings get numbers starting at 1001, and old
`reserved`/`housekeeping` room statuses are converted. Run `npm run db:migrate`
(Vercel does this automatically on deploy).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (applies migrations) / start |
| `npm test` | Unit tests for dates, pricing, GST, folio maths and amount-in-words |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Create the owner and front-desk sign-in accounts only |
| `npm run db:seed:demo` | Also load a demo hotel with rooms, guests and bookings |
| `npm run db:setup:dev` | Migrate + demo data (development) |

## How it works (for developers)

- **Next.js 15 (App Router) + React 19 + Tailwind CSS 4**, API routes, **Prisma + PostgreSQL**.
- Stays are counted in calendar nights. Dates are handled as `YYYY-MM-DD` keys
  (`src/lib/dates.ts`) and “today” uses the hotel’s time zone setting, so night
  counts are identical on any server.
- All pricing and billing maths is pure and unit-tested (`src/lib/pricing.ts`):
  nightly prices with weekend/seasonal adjustments, GST slab selection, discount
  capping, extras tax, payments and refunds.
- `src/lib/bookings.ts` holds availability (overstaying guests keep their room;
  guests leaving today don’t block tonight), per-room advisory locks against
  double booking, and the folio/serialisation used by every screen.
- At checkout a `Bill` snapshot freezes the invoice so later price changes never
  alter past bills.
- Every change is written to `ActivityLog`.

```
src/
├── app/
│   ├── (app)/            # Signed-in screens: Today, calendar, bookings, guests, rooms, …
│   ├── api/              # JSON API (public/* is the guest booking website API)
│   ├── book/             # Public online booking website
│   ├── print/            # Invoice, confirmation and registration card
│   └── login/
├── components/           # UI kit, app shell, booking actions, forms
└── lib/                  # dates, pricing, bookings, reports, settings, auth
prisma/
├── schema.prisma
├── migrations/
└── seed.ts               # accounts (+ demo hotel with --demo)
docs/RESEARCH.md          # competitor & customer research
```

## Not included (yet)

- OTA channel manager (Booking.com / MakeMyTrip / Airbnb sync) — needs paid
  partner agreements. Record OTA bookings with the matching *source* for now.
- Online card payment on the booking website (guests pay at the hotel).
- Restaurant POS, multi-property, GST e-invoicing (IRN).
