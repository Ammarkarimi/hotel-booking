# Technical reference

For whoever works on the code.

## Stack

- **Next.js 15** (App Router) with **React 19** and **Tailwind CSS 4**. Pages
  under `src/app`, JSON API routes under `src/app/api`.
- **Prisma 6** with **PostgreSQL**. Schema in `prisma/schema.prisma`, migrations
  in `prisma/migrations/`.
- Sign-in sessions are signed JWT cookies (`jose`), and passwords are hashed with
  `bcryptjs`.
- Validation uses `zod`, icons use `lucide-react`, and charts use `recharts`.
- File storage is Vercel Blob in production, or the local disk in development
  (`src/lib/storage.ts`).

## Folder map

```
src/
├── app/
│   ├── (app)/                 # Hotel screens (signed in): Today, calendar, bookings, guests,
│   │                          #   rooms, housekeeping, payments, reports, settings, account, help
│   ├── platform/
│   │   ├── login/             # Owner-panel sign-in
│   │   └── (panel)/           # Owner panel: hotels list, add hotel, hotel detail
│   ├── book/
│   │   ├── page.tsx           # /book: redirects when there is one hotel
│   │   ├── [hotel]/           # A hotel's public booking website
│   │   └── confirmation/[token]/
│   ├── print/[kind]/[id]/     # invoice | confirmation | registration
│   ├── login/
│   └── api/                   # JSON API (see below)
├── components/                # UI kit (ui.tsx), app shell, booking actions, platform-ui
├── lib/
│   ├── db.ts                  # Prisma clients and hotel scoping (read this first)
│   ├── auth.ts, session.ts    # Hotel sign-in and sessions; platform tokens
│   ├── platform.ts            # Owner-panel sign-in, password generator, slugify
│   ├── platform-hotels.ts     # Owner-panel queries: overview, detail, delete
│   ├── subscription.ts        # Monthly subscription maths (pure)
│   ├── bookings.ts            # Availability, locks, folio, booking numbers
│   ├── pricing.ts, dates.ts   # Pricing, GST, date keys (pure)
│   ├── reports.ts, settings.ts, public.ts, api.ts, …
│   └── __tests__/             # Unit tests
└── middleware.ts              # Sends signed-out visitors to the right sign-in page
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                    # Starter accounts (+ demo hotel with --demo)
scripts/vercel-build.mjs       # Build script used by Vercel
```

## Data model

| Table | Belongs to | Notes |
|---|---|---|
| `Hotel` | — | One per customer hotel. `slug` is the booking-page address, `status` is `active` or `suspended`, plus `monthlyFee`, `billingStart` (`YYYY-MM`), and `bookingSeq` (last booking number used) |
| `SubscriptionPayment` | Hotel | Money the hotel paid you. `month` is `YYYY-MM`; `clearsMonth = false` means a part payment |
| `Staff` | Hotel | Sign-ins. `email` is unique across **all** hotels. `role` is `admin` (owner / manager) or `staff` (front desk). Also `active` and `lastLoginAt` |
| `HotelSettings` | Hotel (one each) | Profile, tax mode and GST slabs, weekend change, times, invoice prefix, website settings |
| `SeasonalRate` | Hotel | Price change % for a date range, optionally for one room type |
| `Room` | Hotel | `roomNumber` is unique per hotel. `status` is available, occupied or maintenance; `housekeeping` is clean, dirty or cleaning |
| `Guest`, `GuestDocument` | Hotel | Guest profile and ID uploads |
| `Booking` | Hotel | `number` is unique per hotel, from 1001. `publicToken` gives guests their confirmation link. `status` is reserved, checked_in, checked_out, cancelled or no_show |
| `Charge` | Hotel, Booking | Extras on the bill |
| `Payment` | Hotel, Booking | Payments and refunds |
| `Bill` | Hotel, Booking | Invoice frozen at check-out. `invoiceNumber` is unique per hotel |
| `ActivityLog` | Hotel | Who did what |

## How hotels are kept apart

This is the most important design rule. It lives in `src/lib/db.ts`.

- Every table except `Hotel` and `SubscriptionPayment` has a `hotelId`.
- **`prisma`** (the client every hotel screen uses) is a Prisma extension:
  - Every query on a hotel table gets `hotelId = <current hotel>` added to its
    `where`. That covers reads, counts, updates and deletes.
  - Every new row gets the current hotel stamped into its data. Any other
    `hotelId` passed in is overwritten.
  - This also applies inside `prisma.$transaction(async (tx) => …)`.
- The current hotel comes from `runForHotel(hotelId, fn)`, which uses
  AsyncLocalStorage. `withAuth` and `withAdmin` (in `src/lib/api.ts`) call it with
  the signed-in user’s hotel. Public booking routes use `withPublicHotel`, which
  reads `?hotel=<slug>`.
- **Fail-closed:** using `prisma` on a hotel table outside `runForHotel` throws
  “No hotel selected”. It never returns every hotel’s rows.
- **`rawPrisma`** skips the filter. It is used only for:
  - sign-in, where the hotel is found from the email
  - the booking-confirmation token lookup
  - checking that a sign-in email is free across all hotels
  - the owner panel
  - the seed script

  Using it anywhere else is a bug.
- Uploaded files are stored under `hotels/<hotelId>/…`. `/api/uploads` only serves
  a file if it belongs to a document of the signed-in hotel.
- Covered by `src/lib/__tests__/tenant.test.ts`. The multi-hotel change was also
  tested end-to-end with two hotels trying to reach each other’s data.

**When adding a feature:** use `prisma` inside `withAuth` or `withAdmin`. Include
`hotelId: currentHotelId()` when creating rows; TypeScript requires it. Don’t
import `rawPrisma` into hotel code.

## Sessions and access

| | Hotel sign-in | Owner panel |
|---|---|---|
| Cookie | `hotel-session` | `platform-session` (`SameSite=Strict`) |
| Token type | `typ: "hotel"` | `typ: "platform"` |
| Lifetime | 7 days | 12 hours |
| Checked on each request | Staff still exists and is active, and the hotel is `active` | Email and a key derived from the current password match the Vercel settings |

`src/middleware.ts` redirects signed-out visitors to `/login` or
`/platform/login`. Each token type is rejected in the other area. The middleware
only checks the token’s signature; the full checks run in `getSession()` and
`getPlatformSession()` on every API call and page.

- Sign-in attempts are rate-limited in memory, per server instance.
- The public booking form has a hidden spam trap and is rate-limited.

## Booking rules worth knowing

- Dates are `YYYY-MM-DD` keys. “Today” uses the hotel’s time zone setting.
- A booking blocks a room from its arrival night up to, but not including, its
  leaving date. A guest leaving today doesn’t block tonight.
- A guest still checked in after their leaving date keeps the room until they
  check out.
- Saving a booking takes a per-room database lock (`pg_advisory_xact_lock`), so
  two people can’t book the same room at once.
- Booking numbers come from `Hotel.bookingSeq`, which is increased inside the
  booking’s transaction.
- Pricing (`src/lib/pricing.ts`):
  - nightly price = base rate ± weekend change (Fri/Sat nights) ± seasonal change,
    unless the booking has a fixed agreed rate
  - GST slab chosen by nightly tariff, or a flat rate
  - extras taxed separately
  - discount capped at the room total

## API

All responses are JSON. Errors look like `{ "error": "message" }`.

### Hotel screens (hotel session; ⓐ = owner / manager only)

| Route | Methods |
|---|---|
| `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/password` | POST, POST, GET, POST |
| `/api/dashboard`, `/api/calendar`, `/api/search`, `/api/availability` | GET |
| `/api/bookings` | GET (filters: `view`, `status`, `q`, `from`, `to`, `guestId`), POST |
| `/api/bookings/[id]` | GET, PATCH (change stay), POST (`action`: `check_in`, `check_out`, `cancel`, `no_show`, `undo_check_in`), DELETE ⓐ |
| `/api/bookings/[id]/charges` | POST, DELETE |
| `/api/payments` | GET, POST, DELETE ⓐ |
| `/api/guests`, `/api/guests/[id]` | GET, POST / GET, PUT, DELETE ⓐ |
| `/api/guests/[id]/documents`, `/api/uploads?path=` | POST, GET, DELETE / GET |
| `/api/rooms`, `/api/rooms/[id]` | GET, POST ⓐ / GET, PUT ⓐ, DELETE ⓐ |
| `/api/rooms/[id]/housekeeping` | POST |
| `/api/settings` | GET, PUT ⓐ |
| `/api/settings/seasonal-rates` | POST ⓐ, DELETE ⓐ |
| `/api/staff`, `/api/staff/[id]` | ⓐ GET, POST / PUT, DELETE |
| `/api/reports`, `/api/reports/export?type=bookings\|payments\|invoices\|daily` | ⓐ GET |
| `/api/activity` | ⓐ GET |

### Public booking website (no sign-in; `?hotel=<slug>` required)

| Route | Methods |
|---|---|
| `/api/public/hotel` | GET: hotel profile and room types |
| `/api/public/availability?checkIn=&checkOut=&guests=` | GET |
| `/api/public/bookings` | POST |
| `/api/public/bookings/[token]` | GET: confirmation (token only, no `hotel` needed) |

### Owner panel (owner-panel session)

| Route | Methods |
|---|---|
| `/api/platform/login`, `/api/platform/logout` | POST |
| `/api/platform/hotels` | GET (overview and totals), POST (create a hotel and its owner; returns the password once) |
| `/api/platform/hotels/[id]` | GET, PATCH (details, fee, `status`), DELETE (`{ "confirmName": "<hotel name>" }`) |
| `/api/platform/hotels/[id]/payments` | POST (`month`, `months`, `amount`, `method`, `clearsMonth`, `paidOn`, `reference`, `notes`) |
| `/api/platform/hotels/[id]/reset-password` | POST (`{ "staffId": … }`; returns the new password) |
| `/api/platform/payments/[id]` | DELETE |

## Running it on your computer

Requirements: Node.js 20+ and PostgreSQL 14+ (or Docker).

```bash
docker compose up -d          # or use your own PostgreSQL
cp .env.example .env          # set DATABASE_URL; set PLATFORM_ADMIN_* to try /platform
npm install
npm run db:setup:dev          # migrations + demo hotel "Sunrise Residency"
npm run dev                   # http://localhost:3000
```

Demo sign-ins:

- hotel: `admin@hotel.com` / `admin123`, `staff@hotel.com` / `staff123`
- owner panel: whatever you put in `.env`
- booking site: <http://localhost:3000/book/sunrise-residency>

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (generate, migrate, build) / start |
| `npm test` | Unit tests: dates, pricing & GST, folio, amount in words, subscriptions, hotel scoping |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Apply migrations |
| `npm run db:migrate:dev` | Create a new migration after editing the schema (development only) |
| `npm run db:seed` | Starter sign-ins for the first hotel (safe for production) |
| `npm run db:seed:demo` | Also demo rooms, guests and bookings (never in production) |

## Changing the database schema

1. Edit `prisma/schema.prisma`. Any new hotel-owned table needs `hotelId`, a
   relation to `Hotel`, and an entry in `HOTEL_MODELS` in `src/lib/db.ts`.
2. Run `npm run db:migrate:dev -- --name short_description` against a local
   database. Read the generated SQL. If existing rows need values, edit the SQL to
   backfill them.
3. Commit the migration with the code. Vercel applies it on the next production
   deploy.

## Not built yet

- Online payment for subscriptions (record them in `/platform` for now) and for
  guest bookings (guests pay at the hotel).
- OTA channel manager sync with Booking.com, MakeMyTrip and Airbnb. For now,
  record those bookings with the matching source.
- One owner running several hotels from a single sign-in.
- Restaurant POS and GST e-invoicing (IRN).
