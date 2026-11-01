# Hotel software guide

What a hotel can do once it signs in at `/login`. Use this to demo the software
and to answer customers’ questions. The same short guide is built into the app
under **Help & guide**.

## Roles inside a hotel

| | Owner / manager | Front desk |
|---|:-:|:-:|
| Bookings, check-in/out, payments, extras, guests, ID photos, guest forms, calendar, housekeeping | ✅ | ✅ |
| Write down expenses | ✅ all | ✅ their own, last 7 days |
| Reports and CSV downloads | ✅ | — |
| Settings (hotel details, prices & tax, online booking, staff, activity history) | ✅ | — |
| Add, edit or delete rooms | ✅ | — |
| Delete a booking, a guest or a payment | ✅ | — |

Each hotel must always keep at least one active owner / manager account.
Switched-off staff lose access straight away. Everyone can change their own
password under **My account**.

## Screens

### Today

The home screen shows what needs attention now:

- **Arriving today**, each with a *Check in* button
- **Leaving today**, each with a *Check out* button
- guests staying, free rooms tonight, rooms to clean, money received today, and
  money still to collect
- a colour board of every room. Tap a free room to book it.
- a **Getting started** checklist for new hotels

Big buttons: **New booking**, **Walk-in guest**, **Room calendar**.

### New booking (4 steps)

1. **Dates.** Quick buttons for “1 night”, “2 nights” and so on.
2. **Room.** Only free rooms are shown, each with its total price.
3. **Guest.** Search a returning guest by name or phone, or type a new one.
4. **Price & payment.** Agreed price, discount, **GST on the room** (the default
   from Settings is selected; tap 0%, 5%, 12%, 18% or “Other” for this booking
   only), where the booking came from (walk-in, phone, website, Booking.com,
   MakeMyTrip, Goibibo, Agoda, Airbnb…), and any advance payment.

Afterwards, **Send on WhatsApp** sends the guest a confirmation. It names the
kind of room (for example “Deluxe room”), not the room number, so the hotel can
still move the guest before arrival. The printed confirmation does the same.
**Walk-in guest** uses the same steps and checks the guest in immediately.

**No double bookings:** the room is locked while a booking is saved, so two
people can never book the same room for the same night.

### Booking page

Open any booking (search at the top of the screen) to:

- see the live bill: room nights (with weekend and festival prices), discount,
  extras, taxes, payments and balance
- **Check in**, **Check out**, **Cancel**, **Guest did not come** (no-show) and
  **Undo check-in**
- **Change** the stay: extend by a night, change dates, move to another free room,
  or change the price, discount or GST on the room. The check-out screen also
  lets you change the GST before the final invoice is made
- **Add item** to the bill: food, laundry, minibar, taxi, extra bed or damage
- take payments (cash, UPI, card, bank transfer, or **Booking site (prepaid)** for
  a guest who paid on MakeMyTrip, Goibibo, Booking.com and so on) and **Refund**
- for booking-site stays, the owner fills in **Booking site payout**: the site's
  booking ID, its commission, GST on commission, TCS and TDS, and the amount it
  pays (worked out from the deductions, or typed in), then ticks when the money
  reaches the bank, with the UTR. The bill and GST invoice stay on the gross
  amount; the payout is for the owner's accounts only
- print the **tax invoice**, the **proforma bill** (during the stay), the
  **booking confirmation** and the **guest registration card**

At check-out the bill is frozen as the final invoice, numbered
`<prefix>-<booking number>`, for example `INV-1014`. Later price changes never
alter it. When leaving early, the hotel can charge only the nights stayed or the
full booking. When a guest is checked out after their leaving date, the extra
nights are added, unless staff choose to charge only up to the booked date (for a
guest who really left on time). The check-out screen always shows the exact final
bill before anyone presses the button.

### Guest forms (WhatsApp)

Instead of typing a guest's details at the desk, send them a form:

1. Press **Send guest form** on Today (or **Guest forms → Send a form**). Type
   the guest's WhatsApp number, and their name and dates if you know them. Press
   **Send on WhatsApp** and then Send in WhatsApp. The link works for 7 days.
2. The guest opens the link on their phone and fills in: arrival and leaving
   dates, adults and children, name, mobile, date of birth, email, nationality,
   home address (house and street, city, state, PIN code), where they are coming
   from and going next, their vehicle number, and the name of every other adult.
   For every adult they choose **Aadhaar** (shown at check-in, nothing uploaded)
   or upload a photo or PDF of another ID (driving licence, voter ID; passport
   and visa for foreign guests). No ID number is asked. They tick that they
   agree and press Send.
3. The front desk gets a pop-up within 30 seconds, a red number on **Guest
   forms** and a card on Today. Press **Choose room & book**: the dates, people
   and special requests are already filled in, and the guest's details and ID
   copies are shown. If the mobile number belongs to a returning guest, choose
   whether it is the same person. Pick the room, check the price and confirm.
4. The guest profile, any ID copies (named by person) and the booking's
   journey, vehicle and companions are saved, and they print on the
   registration card.
5. At check-in, verify each adult's ID under **ID check** on the booking (see
   below).

A form can be sent again (another 7 days) or closed. Closing a filled-in form
deletes the details and ID copies the guest sent. A form can make only one
booking.

### ID check at check-in (Aadhaar QR)

**Nothing from an Aadhaar is saved anywhere in the software**: no number, no
copy, no photo. Instead the front desk checks it is genuine:

1. On the booking, **ID check** lists every adult. Press **Scan Aadhaar** and
   point the phone camera at the QR code on the Aadhaar card, e-Aadhaar or the
   Aadhaar app (or choose a photo or screenshot of the QR).
2. The phone checks UIDAI's digital signature in the QR. If it is genuine it
   shows **Genuine Aadhaar: signed by UIDAI** with the name, photo, date of
   birth and district from the card, and whether the name matches the booking.
3. Look at the guest. If the photo is them, press **Photo matches: verified**.
   Only “Aadhaar verified with its QR code, by Pooja, 3 Nov 4:10 pm” is saved;
   what was read from the card is forgotten when the screen closes.
4. For another ID, press **Other ID**, choose which one you saw and press **I
   checked it**.

Check-in warns when not every adult has been checked. A QR that is not signed
by UIDAI (a fake, or an old card printed before 2021 with an older key, or the
plain QR on letters before 2018) is refused: ask for the Aadhaar app, a newly
downloaded e-Aadhaar or another photo ID. A check marked by mistake can be
removed by the owner, or by the same person on the same day.

### Room calendar

A chart of every room for 7 or 14 days. Coloured bars are bookings and white
boxes are free. Tap a free box to book that room from that day.

### Bookings

A list with filters: **Coming**, **Staying now**, **Not fully paid** (guests
staying or already left who still owe money), **Past & cancelled**, and **All**. Search by name, phone, room or booking number.

### Guests

Guest profiles show every stay, nights, total paid and money owed. Each profile can hold:

- ID photo uploads straight from the phone camera, or an existing photo or PDF
  (PAN, passport, visa, driving licence, voter ID). Aadhaar copies are never
  saved: scan its QR code at check-in instead. Photos are shrunk
  on the phone before sending, so they upload quickly; PDFs must be under 4 MB.
- passport and visa numbers for foreign guests
- company name and GSTIN for business invoices
- **VIP** and **do not allow** flags

### Housekeeping

Each room is **Needs cleaning**, **Being cleaned** or **Clean**, with who is
cleaning it and notes. Rooms become *Needs cleaning* automatically at check-out.
Rooms with guests arriving today are shown first. A room can also be set to
**maintenance**, which stops anyone booking it.

### Payments

Every payment and refund for today, yesterday, this week, this month or any
dates, with totals per method. The **Cash drawer** box shows cash received minus
cash paid for expenses: the cash that should be in the drawer at the end of a shift.

### Expenses

Every cost the hotel pays: amount, what it was for, kind of cost, date, how it
was paid (cash, UPI, card, bank transfer) and optional notes such as a bill
number. Kinds of cost: staff salaries, electricity & water, room & cleaning
supplies, food & kitchen, laundry, repairs & maintenance, rent, internet &
phone, booking site commission, advertising, taxes & licences, and other.

- **Owner / manager:** sees and changes every expense, for any day, week, month,
  year or dates, with totals by kind of cost and a download for Excel.
- **Front desk:** can write down costs from the last 7 days (e.g. supplies bought
  with drawer cash) and fix their own entries on the same day. They see only
  their own entries, so salaries stay private.

### Staff shifts

Front-desk staff work in shifts (the owner can switch this off in Settings →
Staff; owners and managers never need to).

- **Start of shift:** after signing in, a screen shows the latest handover notes
  and stays until the staff member presses **Start my shift**, with an optional
  note such as the cash in the drawer. A timer then runs in the top bar.
- **End of shift:** **End shift** shows what they did on the shift (guest
  check-ins, check-outs, new bookings, money received, cash to hand over). A
  **handover note** for the next person is compulsory, and they must type the
  random code shown on screen. Then **Send to owner on WhatsApp** opens WhatsApp
  with the shift report addressed to the owner's number, and they sign out.
- **Next person:** sees that handover note before starting their own shift, and
  it shows on the Today screen.
- **How many at once:** the owner sets how many people work at the front desk at
  the same time (Settings → Staff, default 1). While there is room, staff just
  start their shift.
- **Taking over a full desk:** when the desk is full, the new person chooses
  whose shift they are taking over. That person gets a pop-up within seconds
  ("Sana wants to take over your shift"): they write their handover note and
  press **Accept & hand over** (their shift ends and Sana's starts at the same
  moment), or **Not now** (Sana is told and can choose someone else). Nobody's
  shift is ended without them agreeing. If the person has already left, the
  owner approves the request in **Staff shifts** (the shift ends without a
  note). Every check-in, check-out and payment counts only for the person who
  did it. Without an open shift, front-desk staff cannot check
  guests in or out, take payments or change bookings, even if still signed in.
- **Saved for good:** notes and the shift report are saved on the server when the
  shift ends and cannot be changed. Editing the WhatsApp message before sending
  does not change the saved report the owner sees.
- **Owner:** **Staff shifts** lists who is on shift now, attendance per person
  (shifts, hours, check-ins, check-outs, money) for any day, week, month or
  dates, and every shift with its notes, the bookings checked in and out, how it
  ended and the report as saved. New reports have a red badge. A shift someone
  forgot to end can be closed.
- **Staff report (Excel):** one row per shift (the same name appears on several
  rows across days): date, start, end, time on duty, hours, how it ended,
  check-ins and check-outs with booking numbers, new bookings, money by method,
  cash paid for expenses, cash to hand over, the start note and the handover
  note as saved; then totals per person (shifts, days worked, hours, check-ins,
  check-outs, bookings, money).

### Reports (owner)

Choose **Day**, **Week** (Monday to Sunday), **Month** or **Year** and step back
or forward with the arrows, or choose any dates. The current week, month or year
is shown up to today; the owner can include the rest of it to see bookings
already made. Longer periods can be shown by day, week or month. All amounts are
before GST.

- **Profit:** room earnings + extras − expenses − booking-site commission and
  fees, and the profit margin. TCS and TDS kept by sites are not costs (they can
  be claimed back) and are shown separately
- **Per-room numbers**, all using the rooms for sale each night. A room under
  repair is left out from today onwards; past nights count every room, because
  the room may have been sold then:
  - **How full (occupancy):** rooms sold ÷ rooms available
  - **Average price per room sold (ADR):** room earnings ÷ rooms sold
  - **Earnings per available room (RevPAR):** room earnings ÷ every room, sold
    or empty. With 25 rooms and 10 sold at ₹5,000, ADR is ₹5,000 but RevPAR is
    ₹50,000 ÷ 25 = ₹2,000
  - **All earnings per available room (TRevPAR):** rooms + extras ÷ every room
  - **Cost per available room** and **cost per room sold:** costs (expenses +
    booking-site commission) ÷ every room, and ÷ rooms sold
  - **Profit per available room (GOPPAR):** profit ÷ every room
- a chart of earnings against expenses, an occupancy chart, and a table for each
  day, week or month with a total row
- each room type's nights sold, occupancy, ADR, RevPAR and earnings, and
  earnings by booking source
- expenses by kind, money in and out (received by method, expenses paid, cash
  left), guests arriving and leaving, people, average stay, new bookings,
  cancellations and no-shows
- extras sold, a GST summary, and who still owes money
- **Booking site payouts** for stays ending in the period, by site and per stay:
  bills (gross), commission and fees, TCS + TDS, what the sites pay you, and how
  much has been received or is still waiting. Stays with no payout entered yet
  are flagged. **Money in and out** counts what the sites actually paid into the
  bank, not the gross the guest paid them

**Print / save PDF** prints the report without the menu. **CSV downloads for
Excel:** the summary (by day, week or month, with a total row), expenses,
bookings, payments, GST invoices, room types, and **booking site payouts** (one
row per stay with the site's booking ID, gross bill, each deduction, net, and
received date and UTR, to tick off against the site's own statement).

### Settings (owner)

| Tab | What’s there |
|---|---|
| Hotel details | Name, tagline, address, phone, email, GSTIN, invoice number prefix, check-in/out times, currency, time zone |
| Prices & tax | The default GST on rooms: Indian GST slabs (0% up to ₹1,000, 5% up to ₹7,500, 18% above; editable) or one flat rate, which staff can change for one booking; tax on extras; weekend price change %; special prices for date ranges (festivals, off-season) |
| Online booking | Switch online bookings on or off, “About your hotel”, hotel rules / cancellation policy, and the hotel’s booking link to copy and share |
| Staff | Shifts on or off, how many people work at the front desk at the same time, and your WhatsApp number for shift reports; add staff, choose owner / manager or front desk, reset passwords, switch accounts off |
| Activity history | Who did what and when: bookings, payments, check-ins, setting changes, sign-ins, and password resets done by you from `/platform` |

## The hotel’s online booking website

Each hotel gets its own commission-free booking page at `/book/<hotel-name>`.
Hotels find their link in *Settings → Online booking*, and you can see it on the
hotel’s page in `/platform`.

On the booking page:

- Guests choose dates and the number of adults and children. They see each room
  type that is free, with the total price including tax.
- They enter their name and phone, then get a confirmation page with a booking
  number and buttons to WhatsApp or call the hotel.
- Guests pay at the hotel. There is no online card payment yet.
- Bookings appear in the hotel’s software marked as coming from the website. The
  cheapest free room of that type is chosen automatically.

Limits:

- Bookings can be made from today up to one year ahead.
- A stay can be at most 30 nights.
- Each internet connection can make 5 bookings per hour. A hidden spam trap
  stops bots.

Online booking stops if the hotel switches it off, or if you pause the hotel.

The plain `/book` address only redirects when there is a single hotel. With
several hotels, it asks guests to use the link their hotel gave them.

## Colours used everywhere

- **Green**: free, clean or paid
- **Blue**: guest staying
- **Yellow**: booked, arriving or part paid
- **Red**: needs cleaning or money owed
