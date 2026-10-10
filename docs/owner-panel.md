# Owner panel (`/platform`)

The owner panel is where you, the software provider, run the business: add
hotels, give them sign-ins, and track who has paid you each month.

Open <https://hotel-booking-8fzz.vercel.app/platform>.

## Signing in

- Use the email and password you set in Vercel as `PLATFORM_ADMIN_EMAIL` and
  `PLATFORM_ADMIN_PASSWORD`.
- This is the only owner-panel account. Nobody can create another one from inside
  the app, and hotel accounts can never open `/platform`.
- You stay signed in for 12 hours. **Sign out** is at the top right (the arrow
  icon on a phone).
- After 5 wrong attempts from the same place, sign-in is blocked for 15 minutes.
- Forgot the password? Look it up, or set a new one in Vercel. See
  [hosting](hosting.md#change-your-owner-panel-password).

## The dashboard

The first screen shows:

| Box | Meaning |
|---|---|
| **Hotels** | How many hotels you have, and how many are paused |
| **Received in <month>** | Money you recorded as received this month (by payment date), and what you expect each month from active hotels |
| **Not paid this month** | Hotels that haven’t paid for this month yet. Tap it to list them |
| **Still to collect** | Total owed, including this month, and how many hotels are late from earlier months. Tap it to list them |

Below that is the list of hotels. Use the filters **All**, **Not paid this
month**, **Late** and **Paused**, or search by name, city or phone. Each hotel shows:

- its status (**Active** or **Paused**)
- this month’s payment status and any late months
- its fee and how much it owes
- whether it actually uses the software: rooms set up, bookings in the last
  30 days, and when someone last signed in

At the bottom is **Latest payments received**.

## Add a new hotel

1. Press **Add a hotel**.
2. Fill in:
   - **Hotel name** and **City**.
   - **Booking page name** (optional). This is the address of their booking
     website, `/book/<name>`. Leave it empty to make one from the hotel name.
   - **Owner’s name** and **Owner’s phone**. The phone is used for the WhatsApp
     button.
   - **Owner’s email**. They sign in with this, and it can’t already be in use at
     another hotel.
   - **Password** (optional). Leave it empty to get an easy-to-type one, like
     `kq7m-29xh-ptd4`.
   - **Monthly fee (₹)**. Use `0` for a free account.
   - **First month to charge**. Choose a later month to give free months, for
     example “Dec 2026 (2 free months)”.
3. Press **Create hotel and sign-in**.
4. **Send the sign-in details now** with **Send on WhatsApp** or **Copy message**.
   The password is shown only once. If it’s lost, create a new one later; see
   [New password for a hotel](#new-password-for-a-hotel).

The message includes the sign-in page, email, password, their booking-page link,
and a reminder to change the password.

### New-hotel checklist (what to tell the owner)

After they sign in, the **Getting started** box on their *Today* screen walks
them through it. In short:

1. *Settings → Hotel details*: address, phone, GSTIN, check-in and check-out times.
2. *Rooms → Add room*: every room with its type and normal price.
3. *Settings → Prices & tax*: GST slabs or a flat tax, weekend and festival prices.
4. *Settings → Staff*: a sign-in for each front-desk person.
5. *Settings → Online booking*: copy the booking link and share it on WhatsApp,
   Instagram and Google Maps.
6. *My account*: change the password you gave them.

## Record a payment

When a hotel pays you:

1. Open the hotel and press **Record a payment**.
2. **For the month of** is already set to the oldest unpaid month, or the next
   month after what is already paid.
3. **Number of months**: choose 3, 6 or 12 if they paid ahead. The amount is
   split evenly across the months.
4. **Amount received**: filled in with the fee. Change it if they paid a
   different amount.
5. **Paid by** (UPI, bank transfer, cash, card, cheque, other), **Date received**,
   and optionally the **Reference** (UPI or bank transaction number) and a **Note**.
6. **Mark this month as fully paid**:
   - It is on automatically when the amount covers the fee.
   - Turn it off for a part payment, so the rest stays due.
   - Leave it on to count a month as paid even if they paid less, for example
     an old price or a discount.
7. Press **Save payment**.

Recorded something wrong? In **Payment history**, press the bin icon next to the
payment. That month shows as not paid again.

### What the month labels mean

| Label | Meaning |
|---|---|
| **Paid** | Fully paid, either the full fee or marked as fully paid |
| **Part paid** | Some money received, but not the full month. The rest is shown as due |
| **Not paid** | Nothing received for that month |
| **Free** | The hotel’s fee is ₹0 |
| **Billing not started** | Still inside their free months |

**Late** means an earlier month (not the current one) is not fully paid. A hotel
with late months:

- shows in the **Late** filter
- shows a polite reminder to its owner when they sign in: “Your software
  subscription for … is not paid yet…”

Front-desk staff don’t see this reminder.

**Paid until** is the last month paid in a row, counting from this month. For
example, “Dec 2026” means October, November and December are paid.

“This month” follows Indian time (`Asia/Kolkata`) unless `PLATFORM_TIMEZONE`
says otherwise.

### Changing a hotel’s fee

Change **Monthly fee** in **Hotel details** and save. Months already marked
**Paid** stay paid. Unpaid months are worked out with the new fee.

## New password for a hotel

When an owner or staff member forgets their password:

1. Open the hotel. Under **Sign-in accounts**, press **New password** next to
   the person.
2. Confirm. Their old password stops working straight away, and their account
   is switched back on if it was switched off.
3. Send the new password with **Send on WhatsApp** or **Copy message**.

Hotel owners can also reset their own staff’s passwords in *Settings → Staff*.

## Edit a hotel’s details

In **Hotel details** you can change the name, city, contact person, phone,
email, booking page name, monthly fee, first month to charge, and your notes.

- Changing the **name** also changes it on the hotel’s invoices and booking
  website.
- Changing the **booking page name** breaks links the hotel has already shared.
  Tell them the new link.

## Pause a hotel (for example, payment is very late)

Press **Pause hotel** and confirm. Straight away:

- everyone at that hotel is signed out and can’t sign in. They see: “This hotel’s
  account is paused. Please contact your software provider…”
- their booking website stops taking bookings

**Nothing is deleted.** Press **Switch back on** to restore everything immediately.

## Delete a hotel

Only for hotels that will never come back, such as a test hotel. Press **Delete
hotel**, type the hotel’s exact name, and press **Delete everything**.

This removes the hotel’s bookings, guests, bills, payments, rooms, staff
sign-ins, settings and your payment records for it. **It cannot be undone.**
Uploaded ID photos stay in file storage but can no longer be opened from the app.
If in doubt, pause the hotel instead.

## Monthly routine (suggested)

1. At the start of the month, filter **Not paid this month** and send reminders.
2. When money arrives, **Record a payment** with the UPI or bank reference.
3. Around the 10th, check the **Late** filter. Call those hotels.
4. If a hotel is several months late, **Pause** it. Switch it back on when they pay.
5. Check the usage line for each hotel. Hotels with no recent sign-ins or
   bookings may need help, or may be about to leave.
