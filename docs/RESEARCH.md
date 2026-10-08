# Market Research: What Small Hotels Actually Need

This document summarises the competitor and customer research that shaped the
feature set of this software. It is written so a non-technical hotel owner can
read it.

## Who we are building for

Independent, owner-run hotels, guest houses, lodges and homestays with roughly
5–60 rooms. Front-desk staff change often, many have little computer
experience, and the owner wants to see money and occupancy without asking.

## Competitors we looked at

| Product | Who it is for | What people like | What people complain about |
|---|---|---|---|
| **Cloudbeds** | Small–mid hotels, global | All-in-one: PMS, booking engine, channel manager | Expensive once add-ons and payment fees are added ($200–$1000/month); some reports are inaccurate |
| **Little Hotelier** (SiteMinder) | Small properties, B&Bs | Simple calendar, mobile app, protection from double bookings | Gaps in group bookings, duplicate guest records, billing |
| **RoomRaccoon** | Small hotels | Bookings, guest messaging and invoicing in one place | Price |
| **eviivo** | B&Bs, boutique hotels | Single-screen calendar with bookings, availability and rates | — |
| **eZee Absolute** | Small–mid hotels, strong in India | Feature-rich, 4.6★ on Capterra | Learning curve for new staff |
| **Hotelogix** | Small–mid hotels, India | GST-compliant invoices, cheap entry price | Many modules to learn |
| **Djubo** | Indian small hotels | Mobile-first | — |

## The common complaints (pain points)

1. **"Too complicated."** Systems are built for big hotels. Staff need days of
   training, and staff turnover in hospitality is high, so training must take
   minutes, not weeks.
2. **"Too expensive."** Monthly fees plus add-ons plus payment fees.
3. **"Reports I cannot trust or understand."** Owners want to see today's money,
   who owes money, and how full the hotel is.
4. **Double bookings.** The number-one fear of every hotel owner.
5. **Slow / needs fast internet / does not work on a phone.**

## Features clients actually need (must-haves)

| Need | How this software covers it |
|---|---|
| See which rooms are free on any date | **Room Calendar** (colour-coded tape chart) and **date-based availability** — the system never lets two bookings overlap in one room |
| Take a booking in under a minute | **New Booking wizard**: pick dates → pick a free room → type guest name & phone → done |
| Walk-in guests | "Guest is here now" option checks them in immediately |
| Check-in / check-out | One big button on the Today screen |
| Guest records & ID proof | Guest profiles, repeat-guest search by phone, ID upload (Aadhaar, PAN, Passport, Driving Licence, Voter ID) |
| Extra charges (food, laundry, minibar) | Add charges to a guest's bill at any time |
| Advance, part and full payments, refunds | Payment screen with cash / UPI / card / bank options and automatic "balance due" |
| GST-compliant invoice | Printable invoice with hotel GSTIN, guest GSTIN, CGST/SGST split; optional automatic Indian GST slabs |
| Housekeeping | Clean / Dirty / Cleaning status per room, assign a cleaner, rooms become "dirty" automatically on checkout |
| Owner reports | Occupancy %, ADR, RevPAR, revenue by payment method and booking source, money owed, CSV export |
| Direct online bookings (no commission) | Public **booking website** (`/book`) guests can use from their phone |
| Staff accounts & control | Owner (admin) and front-desk (staff) roles; staff cannot see reports, change settings or delete records; activity log of who did what |
| Price changes for seasons / weekends | Weekend price change % and "special price" date ranges |
| Foreign guest compliance (India) | Printable Guest Registration Card with passport/visa fields (helps with Form C) |
| Share confirmation with guest | One-click WhatsApp message and printable confirmation |
| Works on a phone | Fully responsive layout with a mobile menu |

## Nice-to-haves we deliberately left out (for now)

* **OTA channel manager** (Booking.com, Airbnb, MakeMyTrip sync) — needs paid
  partner API agreements. The data model records the booking *source* so these
  bookings can be entered manually today and integrated later.
* **Online card payments** — the booking website uses "pay at hotel" to avoid
  payment-gateway fees and setup. A gateway such as Razorpay or Stripe can be
  added later.
* **Restaurant POS, multi-property, e-invoicing (IRN)** — beyond the needs of a
  small independent hotel.

## Design principles for "zero tech knowledge" users

* Plain words instead of hotel jargon: "Guest arrived" instead of "Check-in
  folio", "Money received" instead of "Settlement".
* One obvious primary action per screen, large buttons and text.
* A **Today** home screen that answers: who is arriving, who is leaving, who is
  staying, which rooms need cleaning, who still owes money.
* Every screen explains itself in one sentence at the top; empty screens say
  what to do next.
* Friendly confirmation pop-ups before anything that cannot be undone.
* Colours mean the same thing everywhere: green = free/clean/paid,
  blue = guest staying, amber = arriving/pending, red = dirty/owes money.

## Sources

* [Hotel Tech Report — Top Cloudbeds alternatives 2026](https://hoteltechreport.com/cloudbeds/alternatives)
* [CostBench — Best Hotel PMS for Small Hotels 2026](https://costbench.com/best/best-hotel-management-small-hotels/)
* [G2 — Cloudbeds vs Little Hotelier](https://www.g2.com/compare/cloudbeds-vs-little-hotelier)
* [Capterra — Cloudbeds reviews](https://www.capterra.com/p/158839/Cloudbeds/reviews)
* [Capterra — Little Hotelier](https://www.capterra.com/p/144307/Little-Hotelier/)
* [Capterra — Hotelogix vs eZee Absolute](https://capterra.com/compare/76374-135751/Hotelogix-vs-eZee-Absolute)
* [Hotelogix — User-friendly software for owner-managed hotels](https://blog.hotelogix.com/user-friendly-hotel-management-software-for-independent-hotels/)
* [Hotelogix — GST hotel billing software](https://www.hotelogix.com/blog/gst-hotel-billing-software)
* [Smart Order — Hotel PMS comparison matrix](https://www.smartorder.ai/resources/blog/hotel-pms-comparison-matrix/)
* [Amenitiz — 10 essential PMS features for independent hotels](https://amenitiz.com/en/blog/10-essential-pms-features-for-independent-hotels)
* [Innsight — Suitable PMS for independent hotels](https://www.innsight.com/blog/suitable-pms-for-independent-hotels)
* [BW Hotelier — Form C automation for foreign guests](https://bwhotelier.com/article/as-part-of-govt-compliance-ecobillz-offers-c-form-automation-solution-for-hotels-to-manage-foreign-guests-458690)
