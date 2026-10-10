# Hotel Manager — reference guide

Everything about the software in one place: how to sell it, how hotels use it,
how it is hosted, how to fix common problems, and how it is built.

| Guide | Read it when you want to… |
|---|---|
| [Owner panel (`/platform`)](owner-panel.md) | Add a hotel, hand out sign-ins, record monthly payments, pause or remove a hotel |
| [Hotel software guide](hotel-app.md) | Understand what hotels can do, so you can demo it and answer their questions |
| [Hosting & deployment](hosting.md) | Change settings on Vercel, deploy updates, rotate passwords, back up data |
| [Troubleshooting](troubleshooting.md) | Fix “can’t sign in”, “booking page not found”, failed deploys and more |
| [Technical reference](technical.md) | Work on the code: architecture, data model, API, tests, local setup |
| [Market research](RESEARCH.md) | See what competitors offer and what small hotels ask for |

## Quick facts

| What | Where |
|---|---|
| Live site | <https://hotel-booking-8fzz.vercel.app> |
| Your owner panel | <https://hotel-booking-8fzz.vercel.app/platform> |
| Hotel staff sign-in | <https://hotel-booking-8fzz.vercel.app/login> |
| A hotel’s booking website | `https://hotel-booking-8fzz.vercel.app/book/<hotel-name>`, e.g. `/book/jd` |
| Code | <https://github.com/Ammarkarimi/hotel-booking> (branch `master` is live) |
| Hosting | Vercel project **hotel-booking-8fzz** |

## Who signs in where

There are three kinds of people, and each one only sees what they need.

| Who | Signs in at | Account comes from | Can see |
|---|---|---|---|
| **You** (software provider) | `/platform` | `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in Vercel | All hotels, their sign-ins, usage and what they paid you. Not their guests or bookings |
| **Hotel owner / manager** | `/login` | Created by you in `/platform` | Everything in their own hotel, including reports, settings and staff |
| **Hotel front desk** | `/login` | Created by the hotel owner in *Settings → Staff* | Day-to-day work in their own hotel; no reports, settings or deleting |

Guests don’t sign in. They book on the hotel’s booking website.

Each email signs in to one hotel only. The same email can’t be used at two
hotels.

## Important to know

- **Hotels never see each other’s data.** This is enforced for every database
  query, not just hidden on screen. See [technical reference](technical.md#how-hotels-are-kept-apart).
- **Your owner-panel password lives in Vercel, not in the app.** To change it,
  change the setting in Vercel and redeploy. See [hosting](hosting.md#change-your-owner-panel-password).
- **The first hotel (JD) still has the starter sign-ins** `admin@hotel.com` /
  `admin123` and `staff@hotel.com` / `staff123` unless they were changed. Change them
  under *My account* and *Settings → Staff*, or give them new passwords from
  `/platform`.

## History

| Change | What it did |
|---|---|
| PR #1 | The complete hotel software: bookings, calendar, check-in/out, guests, billing & GST, payments, housekeeping, reports, staff, online booking website |
| PR #2 | Fixed Vercel builds failing with `P1012 DATABASE_URL not found` |
| PR #3 | Many hotels on one install, each kept separate, plus the owner panel at `/platform` with monthly payment tracking |
