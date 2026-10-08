# Hotel Manager — simple hotel booking & front-desk software

A complete, easy-to-use system for small and independent hotels, guest houses
and homestays: bookings, a room calendar, check-in/check-out, guest records with
ID photos, billing with GST invoices, payments, housekeeping, owner reports,
staff accounts and a commission-free **online booking website** for guests.

One installation serves **many hotels**. As the software provider you run your
own **owner panel at `/platform`**: create a hotel and its owner's sign-in, and
see every month which hotels have paid you. Each hotel only ever sees its own data.

It is designed for people with **no technical knowledge**: plain words instead
of hotel jargon, big buttons, one obvious next step on every screen, friendly
confirmations, and it works on a phone.

> **Full reference guide:** [docs/](docs/README.md) covers the owner panel, the hotel
> software, hosting, troubleshooting and technical details.
>
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
| **Owner panel (`/platform`)** | For you, the software provider: add hotels and hand out the owner's sign-in (copy or send on WhatsApp), monthly fee and free months, record payments (UPI/bank/cash, several months at once, part payments), see who has paid this month and who is late, give anyone a new password, pause a hotel that doesn't pay, see which hotels actually use the software |
| **Online booking website** | `/book/<hotel>` — guests pick dates, see prices per room type and book (pay at hotel). Bookings appear marked “Our website”. Spam-protected |
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

The guest booking website is at <http://localhost:3000/book/sunrise-residency>.

The provider's owner panel is at <http://localhost:3000/platform>. Set
`PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` in `.env` first (see below).

**Change these passwords** after the first sign-in (*My account*, or *Settings → Staff*).

## Selling the software to hotels (`/platform`)

1. In your hosting settings add `PLATFORM_ADMIN_EMAIL` (your email) and
   `PLATFORM_ADMIN_PASSWORD` (at least 10 characters), then redeploy. This is the
   only owner-panel account. It lives in the hosting settings, not in the
   database, so nobody can create another one from inside the app. Without both
   variables `/platform` stays locked. To change the password, change the variable
   and redeploy; every open owner-panel session is signed out.
2. Open `https://<your-site>/platform` and sign in.
3. **Add a hotel**: hotel name, owner's name, email and phone, monthly fee, and the
   first month to charge (pick a later month to give free months). You get the
   owner's sign-in details once, ready to copy or send on WhatsApp.
4. Each month, open the hotel and **Record a payment** when they pay you. The
   list shows who has paid this month, who is late and how much is still owed.
   Owners of hotels with late months see a polite reminder when they sign in.
5. If a hotel stops paying, **Pause** it: its staff can't sign in and its booking
   page stops taking bookings, but nothing is deleted. *Switch back on* restores
   access at once.

Sign-in emails are unique across all hotels, so hotel staff simply sign in at
`/login` and land in their own hotel.

## Setting up a real hotel

1. Deploy (see below) and run `npm run db:seed` once — this creates only the two
   sign-in accounts for the first hotel, no demo data. Further hotels are created
   from `/platform`.
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
| `PLATFORM_ADMIN_EMAIL` | For `/platform` | The software provider's sign-in email for the owner panel |
| `PLATFORM_ADMIN_PASSWORD` | For `/platform` | Its password, at least 10 characters. Changing it signs out open owner-panel sessions |
| `PLATFORM_TIMEZONE` | No | Time zone that decides "this month" for subscriptions (default `Asia/Kolkata`) |

## Deploying (Vercel + Neon)

1. Push to GitHub and import the repository at [vercel.com/new](https://vercel.com/new).
2. **Storage → Create → Neon** (Postgres) and connect it to the project; this sets `DATABASE_URL`.
3. **Storage → Create → Blob** and connect it; this sets `BLOB_READ_WRITE_TOKEN` (for ID photos).
4. Add `JWT_SECRET` under *Settings → Environment Variables*.
5. Deploy. Production builds run `prisma generate → prisma migrate deploy → next build`.
   Preview builds (pull requests and branches) skip the migration step so they never
   change your live database; for fully working previews, add a separate preview
   database as `DATABASE_URL` for the *Preview* environment.
6. Once, from your computer: `DATABASE_URL="<production url>" npm run db:seed`.

### Troubleshooting: build fails with `P1012 Environment variable not found: DATABASE_URL`

That Vercel project has no database configured. Open the project → **Storage** →
connect a Postgres database (or add `DATABASE_URL` under *Settings → Environment
Variables* for **Production**), add `JWT_SECRET`, and redeploy. If two Vercel projects
are connected to this repository, keep the one that has the database and delete or
disconnect the other.

Any Node host with PostgreSQL works (Railway, Render, a VPS): set the variables,
run `npm run build` and `npm start`. For local file storage, keep `./uploads` on a
persistent disk.

### Upgrading an existing installation

The migration `20261008000000_hotel_suite` upgrades databases from the earlier
“Hotel Billing Manager” version in place: existing rooms, guests, bookings,
payments and bills are kept, bookings get numbers starting at 1001, and old
`reserved`/`housekeeping` room statuses are converted. Run `npm run db:migrate`
(Vercel does this automatically on deploy).

The migration `20261009000000_multi_hotel` turns a single-hotel installation into
a multi-hotel one: all existing data is moved into one hotel named after the
current hotel profile, with no monthly fee until you set one in `/platform`. Its
booking page moves to `/book/<hotel-name>`; the old `/book` link keeps redirecting
there while it is the only hotel.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (applies migrations) / start |
| `npm test` | Unit tests for dates, pricing, GST, folio maths, amount-in-words and subscriptions |
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
- **Multi-hotel isolation** (`src/lib/db.ts`): every table except `Hotel` and
  `SubscriptionPayment` has a `hotelId`. The `prisma` client used by the hotel
  screens adds the signed-in hotel to every query and every new row, inside
  transactions too. `withAuth` sets that hotel for each request. A query made
  without a hotel throws instead of returning everyone's data. Only sign-in,
  booking-token lookups and `/platform` use `rawPrisma`.
- The owner panel has its own cookie and token type (`src/lib/platform.ts`), so
  a hotel session can never open `/platform` and an owner-panel session can't
  open a hotel's screens. Subscription maths (paid, part paid, late, paid until)
  is pure and unit-tested in `src/lib/subscription.ts`.

```
src/
├── app/
│   ├── (app)/            # Signed-in screens: Today, calendar, bookings, guests, rooms, …
│   ├── api/              # JSON API (public/* is the guest booking website API)
│   ├── book/[hotel]/     # Public online booking website, one per hotel
│   ├── platform/         # Software provider's owner panel (hotels, subscriptions)
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
- Online subscription payments from hotels (record them in `/platform` for now).
- One owner running several hotels from one sign-in, restaurant POS, GST e-invoicing (IRN).
