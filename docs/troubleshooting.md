# Troubleshooting

## Signing in

**A hotel owner or staff member forgot their password.**

- The hotel owner can reset a staff member’s password in *Settings → Staff*.
- You can reset anyone’s password in `/platform`: open the hotel → **Sign-in
  accounts** → **New password**.

**“Email or password is not correct”, but they are sure it’s right.**

Check that they are on `/login`, not `/platform/login`. Check that their account
isn’t switched off in *Settings → Staff* (or in `/platform`, where it shows
**Switched off**). If in doubt, give them a new password from `/platform`.

**“This hotel’s account is paused. Please contact your software provider…”**

You paused that hotel. Open it in `/platform` and press **Switch back on**.

**“Too many attempts. Please wait 15 minutes and try again.”**

There were too many wrong passwords:

- hotel sign-in: 10 tries per email in 15 minutes
- owner panel: 5 tries in 15 minutes

Wait 15 minutes. A redeploy also clears it.

**“The owner sign-in is not set up yet…” on `/platform/login`.**

`PLATFORM_ADMIN_EMAIL` or `PLATFORM_ADMIN_PASSWORD` is missing in Vercel, or the
password is shorter than 10 characters. Add or fix both for **Production**, then
redeploy. See [hosting](hosting.md#settings-environment-variables).

**I can’t sign in to `/platform` after changing the password in Vercel.**

The new value only takes effect after a **redeploy**. Until then the old
password still works.

**Everyone got signed out at once.**

Something that signs out every session changed:

- `JWT_SECRET` was changed
- the hotel was paused
- for the owner panel only: the owner-panel password changed, or your 12-hour
  session ended

## Booking website

**“This hotel’s booking page was not found. Please check the link.”**

The `/book/<name>` part doesn’t match any hotel. Find the right link on the
hotel’s page in `/platform`. If the booking page name was changed, old links stop
working.

**`/book` says “Please use the booking link your hotel shared with you”.**

That’s expected once there is more than one hotel. Each hotel must share its own
`/book/<name>` link.

**“Online booking is currently closed. Please call the hotel.”**

Either the hotel switched off *Accept bookings online* in *Settings → Online
booking*, or the hotel is paused.

**A room type doesn’t appear on the booking website.**

Either it is fully booked for those dates, or it is under maintenance, or it is
too small for the number of guests chosen.

## Payments / subscriptions in `/platform`

**A month shows “Part paid” but they paid in full.**

The amount recorded was below the fee and **Mark this month as fully paid** was
off. Delete that payment in **Payment history** and record it again with the
switch on.

**A hotel owner sees the unpaid reminder, but they have paid.**

Record the payment for the right month(s) in `/platform`. The reminder disappears
on their next page load.

**I recorded a payment for the wrong hotel or month.**

Delete it in that hotel’s **Payment history** and record it again.

## Deploys (Vercel)

**Build fails with `P1012 Environment variable not found: DATABASE_URL`.**

That Vercel project has no database. Connect one under *Storage*, or add
`DATABASE_URL` for **Production**, then redeploy. A second Vercel project linked
to the same GitHub repo also causes this; delete the extra project.

**Build fails with “✖ DATABASE_URL is not set…”.**

Same cause as above. The build script stops early with this clearer message.

**Build fails during `prisma migrate deploy`.**

A database change couldn’t be applied. Open the deployment’s build log in Vercel
to see the error. The live site keeps running the previous version, so nothing is
broken for users. Fix it and push again, or ask for help with the log.

**The site shows “Something went wrong. Please try again.”**

Look in Vercel → the project → *Logs* (runtime logs) at the time it happened to
see the actual error.

**ID photo upload fails on the live site.**

Blob storage isn’t connected. Vercel → *Storage* → connect Blob, which sets
`BLOB_READ_WRITE_TOKEN`, then redeploy.

## Data

**A hotel says a booking or guest disappeared.**

Check *Settings → Activity history* in their hotel, which shows who deleted or
changed what. Only owner / manager accounts can delete bookings, guests or
payments.

**Can one hotel ever see another hotel’s guests?**

No. Every database query from a hotel’s screens is limited to that hotel, and a
query without a hotel stops with an error instead. This was tested when the
multi-hotel change was built: one hotel tried to read, print, edit, book, search
and open another hotel’s documents, and every attempt was refused. See the
[technical reference](technical.md#how-hotels-are-kept-apart).
