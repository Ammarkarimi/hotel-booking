# Hotel software guide

What a hotel can do once it signs in at `/login`. Use this to demo the software
and to answer customers’ questions. The same short guide is built into the app
under **Help & guide**.

## Roles inside a hotel

| | Owner / manager | Front desk |
|---|:-:|:-:|
| Bookings, check-in/out, payments, extras, guests, ID photos, calendar, housekeeping | ✅ | ✅ |
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
4. **Price & payment.** Agreed price, discount, where the booking came from
   (walk-in, phone, website, Booking.com, MakeMyTrip, Goibibo, Agoda, Airbnb…),
   and any advance payment.

Afterwards, **Send on WhatsApp** sends the guest a confirmation. **Walk-in guest**
uses the same steps and checks the guest in immediately.

**No double bookings:** the room is locked while a booking is saved, so two
people can never book the same room for the same night.

### Booking page

Open any booking (search at the top of the screen) to:

- see the live bill: room nights (with weekend and festival prices), discount,
  extras, taxes, payments and balance
- **Check in**, **Check out**, **Cancel**, **Guest did not come** (no-show) and
  **Undo check-in**
- **Change** the stay: extend by a night, change dates, or move to another free room
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

### Room calendar

A chart of every room for 7 or 14 days. Coloured bars are bookings and white
boxes are free. Tap a free box to book that room from that day.

### Bookings

A list with filters: **Coming**, **Staying now**, **Not fully paid** (guests
staying or already left who still owe money), **Past & cancelled**, and **All**. Search by name, phone, room or booking number.

### Guests

Guest profiles show every stay, nights, total paid and money owed. Each profile can hold:

- ID photo uploads straight from the phone camera, or an existing photo or PDF
  (Aadhaar, PAN, passport, visa, driving licence, voter ID). Photos are shrunk
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

### Reports (owner)

Choose **Day**, **Week** (Monday to Sunday), **Month** or **Year** and step back
or forward with the arrows, or choose any dates. The current week, month or year
is shown up to today; the owner can include the rest of it to see bookings
already made. Longer periods can be shown by day, week or month. All amounts are
before GST.

- **Profit:** room earnings + extras − expenses − booking-site commission and
  fees, and the profit margin. TCS and TDS kept by sites are not costs (they can
  be claimed back) and are shown separately
- **Per-room numbers**, all using the rooms in use (rooms under repair are left
  out):
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
| Prices & tax | Indian GST slabs (0% up to ₹1,000, 5% up to ₹7,500, 18% above; editable) or one flat tax rate; tax on extras; weekend price change %; special prices for date ranges (festivals, off-season) |
| Online booking | Switch online bookings on or off, “About your hotel”, hotel rules / cancellation policy, and the hotel’s booking link to copy and share |
| Staff | Add staff, choose owner / manager or front desk, reset passwords, switch accounts off |
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
