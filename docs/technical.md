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
- The app stores no files. `src/lib/storage.ts` only deletes ID copies saved
  before they were removed (Vercel Blob in production, the local disk in development).

## Folder map

```
src/
├── app/
│   ├── (app)/                 # Hotel screens (signed in): Dashboard, calendar, bookings, guests,
│   │                          #   rooms, housekeeping, payments, expenses, reports, settings, account, help
│   ├── platform/
│   │   ├── login/             # Owner-panel sign-in
│   │   └── (panel)/           # Owner panel: hotels list, add hotel, hotel detail
│   ├── book/
│   │   ├── page.tsx           # /book: redirects when there is one hotel
│   │   ├── [hotel]/           # A hotel's public booking website
│   │   └── confirmation/[token]/
│   ├── print/[kind]/[id]/     # invoice | confirmation | registration
│   ├── welcome/               # Public landing page (shown at / to signed-out visitors)
│   ├── login/
│   └── api/                   # JSON API (see below)
├── components/                # UI kit (ui.tsx), app shell, booking actions, period picker, platform-ui
├── lib/
│   ├── db.ts                  # Prisma clients and hotel scoping (read this first)
│   ├── auth.ts, session.ts    # Hotel sign-in and sessions; platform tokens
│   ├── platform.ts            # Owner-panel sign-in, password generator, slugify
│   ├── platform-hotels.ts     # Owner-panel queries: overview, detail, delete
│   ├── subscription.ts        # Monthly subscription maths (pure)
│   ├── bookings.ts            # Availability, locks, folio, booking numbers
│   ├── pricing.ts, dates.ts   # Pricing, GST, date keys (pure)
│   ├── reports.ts             # Report numbers; hotelMetrics() holds the occupancy, ADR, RevPAR and per-room maths (pure)
│   ├── shifts.ts              # Staff shifts: summary of what a person did between two moments (database)
│   ├── shift-report.ts        # Shift counts, the end-of-shift code and the WhatsApp report text (pure)
│   ├── guest-form.ts          # Express check-in (the WhatsApp guest form): what the guest fills in and its checks (pure)
│   ├── messages.ts            # WhatsApp messages to guests: default wording, {fields} and filling them in (pure)
│   ├── pathik.ts              # Pathik (Gujarat police guest register): a booking or guest as Pathik's Add Guest form (pure)
│   ├── rate-tips.ts           # Rate tips: free rooms per type tonight, what usually still sells, the suggested price, sales insights (pure)
│   ├── guest-forms-api.ts     # Guest form links and the shape staff screens get (database)
│   ├── shift-api.ts           # Shared by the shift API routes
│   ├── periods.ts             # Day / week / month / year ranges and grouping (pure)
│   ├── expenses.ts            # Expense validation and who may change what
│   ├── settings.ts, public.ts, api.ts, …
│   └── __tests__/             # Unit tests
└── middleware.ts              # Signed-out visitors: / shows the landing page, other pages go to sign-in
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                    # Starter accounts (+ demo hotel with --demo)
scripts/vercel-build.mjs       # Build script used by Vercel
scripts/tour/                  # Records the landing-page video and screenshots
public/welcome/                # Landing-page video (MP4 + WebM), poster and screenshots
```

## Data model

| Table | Belongs to | Notes |
|---|---|---|
| `Hotel` | — | One per customer hotel. `slug` is the booking-page address, `status` is `active` or `suspended`, plus `monthlyFee`, `billingStart` (`YYYY-MM`), and `bookingSeq` (last booking number used) |
| `Package` | — | A package the provider sells: `name`, `description`, `monthlyFee` (suggested; 0 = not set), `modules` (list of module keys), `sortOrder`. `Hotel.packageId` points to it; with no package the hotel uses its own `Hotel.modules` |
| `SubscriptionPayment` | Hotel | Money the hotel paid you. `month` is `YYYY-MM`; `clearsMonth = false` means a part payment |
| `Staff` | Hotel | Sign-ins. `email` is unique across **all** hotels. `role` is `admin` (owner / manager) or `staff` (front desk). Also `active` and `lastLoginAt` |
| `HotelSettings` | Hotel (one each) | Profile, tax mode and GST slabs, weekend change, times, invoice prefix, website settings. `msgBooking`, `msgCheckIn`, `msgCheckOut`: the owner's wording for the guest WhatsApp messages (null = the default in `src/lib/messages.ts`). `rateTips`, `rateTipsFrom` (HH:MM), `rateTipsMaxDiscount` (%), `rateTipsFloors` (JSON: lowest price per room type), `rateTipsStaff` (front desk sees tips). `roomPricesIncludeTax`: room prices are entered with GST included (copied onto each new booking) |
| `SeasonalRate` | Hotel | Price change % for a date range, optionally for one room type |
| `Room` | Hotel | `roomNumber` is unique per hotel. `status` is available, occupied or maintenance; `housekeeping` is clean, dirty or cleaning |
| `Guest` | Hotel | Guest profile (`address` is house and street, plus `city`, `state`, `pinCode`). No ID copies are stored (migration `20261127000000_remove_id_copies` dropped `GuestDocument` and queued its files in `FileCleanup`). No ID numbers are stored either (migration `20261128000000_remove_id_numbers` dropped `idNumber`, `passportNo` and `visaNo`): `idType` is only which ID the guest has, and the desk ticks the original as seen (see `IdCheck`) |
| Pathik fields | — | `Guest.locality`, `Guest.district`; `Booking.vehicleType` (four_wheeler, two_wheeler, bus, auto, other, none = no vehicle), `Booking.pathikAt` and `pathikByName` (marked as entered in Pathik); `HotelSettings.pathik` shows "Fill in Pathik" |
| `RateTipSeen` | Hotel | Someone typed "I have seen" on a rate tip: `staffId`, `staffName`, `tipKey` (`date\|roomType\|price`, so a lower price later is a new tip), when. Unique per person and tip |
| `IdCheck` | Hotel, Booking | An adult's ID ticked as verified at the desk after the receptionist looked at the original: `person` (null = the guest who booked), `idType` (aadhar, passport, driving_licence, voter_id, pan, other), who and when. `method` is `id_seen`; rows marked `aadhaar_qr` come from the earlier QR scanner. Nothing from the ID itself is stored |
| `FileCleanup` | — | Old ID copy files waiting to be deleted from storage; `drainFileCleanup()` removes up to 25 every 5 minutes while the app is used |
| `GuestForm` | Hotel | A form sent to a guest on WhatsApp. `token` is the secret in the link (`/form/<token>`), works for 7 days (`expiresAt`). `status` is sent, submitted, booked or cancelled; `details` is the JSON the guest sent (checked by `guestFormSchema` in `src/lib/guest-form.ts`). Making the booking (`POST /api/bookings` with `guestFormId`) claims it once, creates or updates the guest and sets `bookingId` |
| `Booking` | Hotel | `number` is unique per hotel, from 1001. `publicToken` gives guests their confirmation link. `status` is reserved, checked_in, checked_out, cancelled or no_show. `gstRate` is the GST % on the room chosen for this booking (null = the default from Settings). `pricesIncludeTax` copies `HotelSettings.roomPricesIncludeTax` when the booking is made: `ratePerNight` and `discount` then include the room GST, and `computeFolio` takes the GST out (slab from `roomTaxRateIncluded`) so the bill shows the price before GST and the total equals what was entered. `comingFrom`, `goingTo`, `vehicleNumber` and `companions` (JSON names of the other adults) are for police guest registration and usually come from the guest form |
| `Charge` | Hotel, Booking | Extras on the bill |
| `Payment` | Hotel, Booking | Payments and refunds |
| `Bill` | Hotel, Booking | Invoice frozen at check-out. `invoiceNumber` is unique per hotel |
| `ActivityLog` | Hotel | Who did what |
| `Shift` | Hotel | One front-desk shift: `startedAt`, `endedAt`, `startNote`, compulsory `handoverNote`, the `endCode` to type (cleared when it ends), `summary` (JSON counts, booking lists and money, fixed at the end), `reportText` (the report as saved), `endReason` (staff, owner, transferred), `endedBy` when the owner closed or approved it, `ownerSeenAt`. No route edits a shift once ended. A shift starts only while fewer than `HotelSettings.frontDeskStaff` (default 1) are open; when the desk is full a `ShiftTransfer` asks the person on shift (or the owner) to accept, which ends their shift (`endReason` transferred, `handedOverTo`) and starts the new one at the same moment; front-desk changes need an open shift (`assertOnShift`) |
| `ShiftTransfer` | Hotel | A request to take over someone's shift when the front desk is full: `fromShiftId`, `toStaffId`, `startNote`, `status` (pending, accepted, declined, cancelled), who answered and when |
| `Expense` | Hotel | Money the hotel spent: `date` (a day), `category`, `title`, `amount`, `method`, who added it |

`Booking` also holds booking-site payout fields: `otaReference`, `payoutAmount`
(null until entered), `payoutCommission`, `payoutCommissionGst`, `payoutTcs`,
`payoutTds`, `payoutReceivedOn` and `payoutBankRef`. The maths is in
`src/lib/payouts.ts`; the bill always stays on the gross amount. Payment method
`ota` means the guest prepaid on the booking site.

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
- Covered by `src/lib/__tests__/tenant.test.ts`. The multi-hotel change was also
  tested end-to-end with two hotels trying to reach each other’s data.

**Packages and modules:** `src/lib/modules.ts` lists the modules a package can
switch on or off (express check-in, `guest_forms`; Pathik, expenses, reports, shifts, rate tips, the
booking website); everything else is in every package. `getSession` returns the
hotel's modules (`resolveModules`: its package's list, or `Hotel.modules`).

- Routes of a module use `withModule(key, …)` or `withModuleAdmin(key, …)`, which
  answer 403 with "not part of your package".
- `getSettings()` turns off `pathik`, `staffShifts`, `rateTips` and
  `websiteEnabled` when the module is missing, so the rest of the code needs no
  checks. The Settings screen reads and writes the owner's saved values with
  `getStoredSettings()`, so nothing is lost when a module is added back.
- Screens use `useApp().has(key)`. The window hides the menu tab, buttons and
  pop-ups, and shows "Not in your package" on a module's page (`moduleForPath`).
- Guest form links check the module in `withFormLink`.

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
| `/api/bookings` | GET (filters: `view`, `status`, `q`, `from`, `to`, `guestId`), POST (also `comingFrom`, `goingTo`, `vehicleType`, `vehicleNumber`, `companions` [{ name, phone }], and the Pathik address fields `dateOfBirth`, `locality`, `city`, `district`, `state`, `pinCode` on `guest`, or on `guestDetails` for a returning guest, where only filled-in fields change, also `lastName`, `email`, `address`; `idChecks` [{ person, idType }] are the IDs seen at the desk, saved as `IdCheck` rows, and a walk-in (`checkInNow`) needs one for every adult). With `HotelSettings.pathik` on, a desk booking (not from a guest form) missing anything `deskPathikMissing` in `src/lib/guest-form.ts` lists is refused |
| `/api/bookings/[id]` | GET, PATCH (change stay; also `comingFrom`, `goingTo`, `vehicleNumber` and `companions` with `was`, the name before the change, so ID ticks follow a corrected name), POST (`action`: `check_in`, `check_out`, `cancel`, `no_show`, `undo_check_in`), DELETE ⓐ |
| `/api/bookings/[id]/charges` | POST, DELETE |
| `/api/bookings/[id]/bill` | PATCH (`ratePerNight`, `discount`, `gstRate` or null, `reason`, `refundMethod`): Edit bill for a checked-in stay, or a checked-out one by an admin (owner) only. Sets a fixed rate; a final `Bill` keeps its invoice number and gets the new amounts; while staying payments are not touched; after check-out money paid above the new total is saved as a `refund` payment (`refundMethod`, reference "Bill edited"). The printed invoice hides "Balance/Refund due" at 0 and its payment list when there is a refund. The first edit saves the price first agreed in `Booking.originalPrice` (JSON `{ ratePerNight, fixedRate, discount, gstRate }`). Logged as "Bill edited" |
| `/api/payments` | GET, POST, DELETE ⓐ |
| `/api/guests`, `/api/guests/[id]` | GET, POST / GET, PUT, DELETE ⓐ |
| `/api/rooms`, `/api/rooms/[id]` | GET, POST ⓐ / GET, PUT ⓐ, DELETE ⓐ |
| `/api/rooms/[id]/housekeeping` | POST |
| `/api/settings` | GET, PUT ⓐ |
| `/api/pathik` | GET `?bookingId=` (or `?guestId=`: their stay now, else the next arrival, else the guest only): the values of Pathik's Add Guest form (`pathikRecord` in `src/lib/pathik.ts`), the other adults, `missing` and `byHand` (ID photos and Aadhaar numbers, added in Pathik by hand) |
| `/api/bookings/[id]/pathik` | POST `{ entered }`: mark the stay as entered in Pathik (or take the mark off) |
| `/api/rate-tips` | GET: tonight's rooms by type with tips (`tonightByType` in `src/lib/rate-tips.ts`), the tips this person has not confirmed (`unseen`), who confirmed today's tips (owner), `?insights=30` adds sales by type and booking times (owner). POST `{ keys, text }`: `text` must be "I have seen" |
| `/api/settings/seasonal-rates` | POST ⓐ, DELETE ⓐ |
| `/api/staff`, `/api/staff/[id]` | ⓐ GET, POST / PUT, DELETE |
| `/api/expenses`, `/api/expenses/[id]` | GET (front desk: own entries; `?summary=cash` for everyone), POST / PATCH, DELETE (owner, or the person who added it on the same day) |
| `/api/reports?from=&to=&groupBy=day\|week\|month` | ⓐ GET |
| `/api/reports/export?type=summary\|expenses\|bookings\|payments\|invoices\|roomtypes\|payouts` | ⓐ GET. `bookings` has First total (at `Booking.originalPrice`, same nights and extras), Final total and Difference |
| `/api/bookings/[id]/payout` | ⓐ PUT: booking site ID, commission, GST on commission, TCS, TDS, net payout, received date and UTR |
| `/api/activity` | ⓐ GET |
| `/api/guest-forms` | GET (`?count=1` for the badge; `view`: received, waiting, done, all), POST (phone, name, dates: makes the link) |
| `/api/bookings/[id]/id-checks` | POST (`person`, `idType`): tick an adult's ID as verified; DELETE `?checkId=` (owner, or the same person within 12 hours) |
| `/api/guest-forms/[id]` | GET, POST (`action`: `resend` gives the link 7 more days, `cancel` closes it, `edit` with `details` lets the desk correct a filled-in form before booking, checked by `staffFormSchema`) |

### Public booking website (no sign-in; `?hotel=<slug>` required)

| Route | Methods |
|---|---|
| `/api/public/hotel` | GET: hotel profile and room types |
| `/api/public/availability?checkIn=&checkOut=&guests=` | GET |
| `/api/public/bookings` | POST |
| `/api/public/bookings/[token]` | GET: confirmation (token only, no `hotel` needed) |
| `/api/public/guest-forms/[token]` | GET: hotel and suggested dates; POST: send the form (locks it) |
| `/api/public/guest-forms/[token]/documents` | POST (one photo or PDF up to 4 MB; `type`, `person` 0 = the guest, 1… = other adults), DELETE `?docId=` (only before sending) |

### Owner panel (owner-panel session)

| Route | Methods |
|---|---|
| `/api/platform/login`, `/api/platform/logout` | POST |
| `/api/platform/hotels` | GET (overview and totals), POST (create a hotel and its owner; returns the password once) |
| `/api/platform/packages` | GET (with how many hotels are on each), POST (`name`, `description`, `monthlyFee`, `modules`) |
| `/api/platform/packages/[id]` | PATCH (same fields), DELETE (only when no hotel is on it) |
| `/api/platform/hotels/[id]` | GET, PATCH (details, fee, `status`, `packageId`, or `packageId: null` with `modules`), DELETE (`{ "confirmName": "<hotel name>" }`) |
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

## Brand

The product is **Innvela**. The logo (a roof over a V, navy `#0f172a` and blue
`#2548eb`, or white and `#7c93ff` on dark) is drawn in `src/components/brand.tsx`
(`Logo`, `LogoMark`, `LogoIcon`, `Wordmark`; the wordmark uses Bricolage Grotesque,
loaded in `src/app/layout.tsx` as `--font-brand`).

The app looks like desktop software. `src/components/layout.tsx` draws the window:
a blue title bar, section tabs, a toolbar (New booking F2, Walk-in F3, Calendar F4,
Send express check-in, search on `/`, the shift button) and a status bar. All other text
uses the computer's own fonts (Tahoma / Segoe UI). The look is set in
`src/app/globals.css` (`@theme`): `primary-*` is the blue for actions and links,
`chrome` / `chrome-line` are the panel title strips and borders, and the radius and
shadow values are overridden so every corner is square and nothing floats.
`src/components/ui.tsx` has the panels, buttons, fields, tabs and windows. The logo
drawing is also in
`src/app/icon.svg` (browser tab) and `src/app/apple-icon.png` (phone home screen).
`docs/brand/` has logo files for use outside the app: SVG mark and icon, and PNG
logos for light and dark backgrounds.

## Landing page and video tour

Signed-out visitors to `/` see the landing page (`src/app/welcome/`); the middleware
rewrites `/` to `/welcome` for them, so the address stays `/`. Signed-in hotel staff
still get the Dashboard at `/`. `/welcome` and everything in `public/welcome/` are
public.

The page reads `SALES_WHATSAPP` and `SALES_EMAIL` at build time, so redeploy after
changing them.

The video (`public/welcome/innvela-tour.mp4`, plus a WebM copy for browsers
without H.264) and the screenshots are recorded from the real app with the demo hotel.
Re-record them after changing the screens:

```bash
# an empty local database, then:
npm run db:setup:dev
npm run build && npm start                      # in one terminal
npm i --no-save playwright && npx playwright install chromium
node scripts/tour/capture-screens.mjs http://localhost:3000   # needs Python + Pillow
npm run db:seed:demo                            # only if the database was used since seeding
node scripts/tour/record-tour.mjs http://localhost:3000       # needs ffmpeg
```

The recording changes the demo data (it books, checks in and checks out guests), so
start from a freshly seeded database each time. It prints new chapter times: paste
them into `CHAPTERS` in `src/app/welcome/tour.tsx`.

## Pathik helper (Chrome add-on)

`pathik-helper/` is a Manifest V3 Chrome add-on, packed into `public/pathik-helper.zip`
by `scripts/build-pathik-zip.mjs` at every build (the zip is not in git; the build adds
this deployment's own address from `VERCEL_PROJECT_PRODUCTION_URL` to the pages it runs on).

- `app-bridge.js` runs on the software's pages: it marks the page
  (`data-pathik-helper`) so "Fill in Pathik" shows the fill button, takes the record the
  page posts (`window.postMessage`, same origin only) and hands it to the background
  worker. No ID copies are sent: staff attach ID photos in Pathik by hand.
- `background.js` keeps it in `chrome.storage.session` for 30 minutes, opens
  `pathik.guru/dashboard/add`, and refreshes jQuery select plug-ins in the page.
- `pathik-fill.js` runs on pathik.guru. When the Add Guest form is there it fills each
  field found by its **label text** (so it does not depend on Pathik's field names),
  sets the number of adults and fills the blocks Pathik adds for them (grouped where a
  label repeats), attaches the copies, outlines filled (green) and empty required
  (amber) fields and shows a panel. It never presses Submit.

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
- Sending guest details to police portals such as Pathik (Gujarat). The guest
  form already collects what they ask for.
- Scanning the Aadhaar QR code was tried and removed: phone cameras did not
  read it reliably. IDs are checked by hand and ticked.
