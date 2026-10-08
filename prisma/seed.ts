/**
 * Seeds the database.
 *
 *   npm run db:seed        -> owner + front-desk sign-in accounts only (safe for production)
 *   npm run db:seed:demo   -> also a sample hotel profile, rooms, guests, bookings and payments for trying the software
 *
 * Everything goes into the first hotel (created as "My Hotel" if there is none).
 * More hotels are added from the software provider's panel at /platform.
 */
import bcrypt from "bcryptjs";
import { currentHotelId, prisma, rawPrisma, runForHotel } from "../src/lib/db";
import { addDays, dateFromKey, todayKey } from "../src/lib/dates";
import { computeFolio, parseGstSlabs, priceNights } from "../src/lib/pricing";

const withDemo = process.argv.includes("--demo");

async function firstHotel() {
  const existing = await rawPrisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  return (
    existing ??
    rawPrisma.hotel.create({ data: { name: "My Hotel", slug: "my-hotel", billingStart: todayKey("Asia/Kolkata").slice(0, 7) } })
  );
}

async function nextBookingNumber() {
  const hotel = await rawPrisma.hotel.update({ where: { id: currentHotelId() }, data: { bookingSeq: { increment: 1 } } });
  return hotel.bookingSeq;
}

const ROOMS = [
  { roomNumber: "101", type: "single", floor: "Ground", capacity: 1, pricePerNight: 1800, amenities: ["WiFi", "AC", "TV", "Hot Water"], description: "Cosy room for one with a comfortable single bed." },
  { roomNumber: "102", type: "single", floor: "Ground", capacity: 1, pricePerNight: 1800, amenities: ["WiFi", "AC", "TV", "Hot Water"], description: "Cosy room for one with a comfortable single bed." },
  { roomNumber: "103", type: "twin", floor: "Ground", capacity: 2, pricePerNight: 2800, amenities: ["WiFi", "AC", "TV", "Hot Water"], description: "Two separate beds, ideal for friends or colleagues." },
  { roomNumber: "201", type: "double", floor: "First", capacity: 2, pricePerNight: 3200, amenities: ["WiFi", "AC", "TV", "Kettle", "Hot Water"], description: "Spacious room with a queen-size bed." },
  { roomNumber: "202", type: "double", floor: "First", capacity: 2, pricePerNight: 3200, amenities: ["WiFi", "AC", "TV", "Kettle", "Hot Water"], description: "Spacious room with a queen-size bed." },
  { roomNumber: "203", type: "double", floor: "First", capacity: 2, pricePerNight: 3200, amenities: ["WiFi", "AC", "TV", "Kettle", "Hot Water"], description: "Spacious room with a queen-size bed." },
  { roomNumber: "204", type: "family", floor: "First", capacity: 4, pricePerNight: 5200, amenities: ["WiFi", "AC", "TV", "Extra Bed", "Kettle"], description: "Large room with a king bed and two single beds for families." },
  { roomNumber: "301", type: "deluxe", floor: "Second", capacity: 3, pricePerNight: 4800, amenities: ["WiFi", "AC", "TV", "Mini Bar", "Balcony", "Kettle"], description: "Premium room with a private balcony and city view." },
  { roomNumber: "302", type: "deluxe", floor: "Second", capacity: 3, pricePerNight: 4800, amenities: ["WiFi", "AC", "TV", "Mini Bar", "Balcony", "Kettle"], description: "Premium room with a private balcony and city view." },
  { roomNumber: "401", type: "suite", floor: "Third", capacity: 4, pricePerNight: 8500, amenities: ["WiFi", "AC", "TV", "Mini Bar", "Balcony", "Bathtub", "Room Service"], description: "Our best: separate living area, bathtub and panoramic view." },
];

async function seedBasics() {
  const hotelId = currentHotelId();
  // Sign-in emails are unique across all hotels, so look them up without the hotel filter.
  await rawPrisma.staff.upsert({
    where: { email: "admin@hotel.com" },
    update: {},
    create: { hotelId, email: "admin@hotel.com", passwordHash: await bcrypt.hash("admin123", 10), name: "Anil Sharma", role: "admin" },
  });
  await rawPrisma.staff.upsert({
    where: { email: "staff@hotel.com" },
    update: {},
    create: { hotelId, email: "staff@hotel.com", passwordHash: await bcrypt.hash("staff123", 10), name: "Pooja Verma", role: "staff" },
  });

  // Everything below is demo content: a sample hotel profile and rooms.
  if (!withDemo) return;

  if ((await prisma.room.count()) === 0) {
    for (const r of ROOMS) {
      await prisma.room.create({ data: { hotelId, ...r, amenities: JSON.stringify(r.amenities) } });
    }
  }

  // The migration creates an empty "My Hotel" settings row; fill it in only if nobody has edited it.
  const current = await prisma.hotelSettings.findUnique({ where: { hotelId } });
  if (current && current.hotelName !== "My Hotel") return;
  const profile = {
    hotelName: "Sunrise Residency",
      tagline: "Comfortable stays in the heart of the city",
      address: "12 MG Road",
      city: "Bengaluru, Karnataka 560001",
      phone: "+91 98765 43210",
      email: "stay@sunriseresidency.in",
      gstin: "29ABCDE1234F1Z5",
      taxMode: "india_gst",
      bookingTerms:
        "Check-in from 12:00 PM, check-out by 11:00 AM.\nA valid photo ID is required for every adult at check-in.\nFree cancellation up to 24 hours before arrival.",
      websiteAbout:
        "Sunrise Residency is a friendly, family-run hotel a short walk from MG Road metro. Clean rooms, fast WiFi, hot breakfast and 24-hour front desk.",
  };
  await prisma.hotelSettings.upsert({ where: { hotelId }, update: profile, create: { hotelId, ...profile } });
  const hotel = await rawPrisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const slugFree = !(await rawPrisma.hotel.findUnique({ where: { slug: "sunrise-residency" } }));
  await rawPrisma.hotel.update({
    where: { id: hotelId },
    data: { name: profile.hotelName, city: "Bengaluru", ...(hotel.slug === "my-hotel" && slugFree && { slug: "sunrise-residency" }) },
  });
}

const DEMO_GUESTS = [
  { firstName: "Rajesh", lastName: "Kumar", phone: "+91 98450 11223", email: "rajesh.kumar@example.com", nationality: "Indian", address: "Indiranagar, Bengaluru", idType: "aadhar", idNumber: "XXXX XXXX 4821", company: "Kumar Traders", gstin: "29AAACK1234M1Z2" },
  { firstName: "Priya", lastName: "Sharma", phone: "+91 99001 22334", email: "priya.s@example.com", nationality: "Indian", address: "Andheri West, Mumbai", idType: "driving_licence", idNumber: "MH02 2019 0012345", vip: true },
  { firstName: "John", lastName: "Smith", phone: "+1 555 0123", email: "john.smith@example.com", nationality: "American", address: "456 Oak Ave, New York", idType: "passport", passportNo: "X12345678", visaNo: "IN-E-998877" },
  { firstName: "Anita", lastName: "Desai", phone: "+91 98111 44556", nationality: "Indian", address: "Koregaon Park, Pune", idType: "aadhar", idNumber: "XXXX XXXX 9932" },
  { firstName: "Mohammed", lastName: "Irfan", phone: "+91 97400 55667", nationality: "Indian", address: "Banjara Hills, Hyderabad", idType: "pan", idNumber: "ABCPI1234K" },
  { firstName: "Sophie", lastName: "Martin", phone: "+33 6 12 34 56 78", email: "sophie.martin@example.com", nationality: "French", idType: "passport", passportNo: "18AB12345", visaNo: "IN-T-554433" },
  { firstName: "Vikram", lastName: "Reddy", phone: "+91 90080 66778", nationality: "Indian", address: "Jayanagar, Bengaluru" },
  { firstName: "Meera", lastName: "Nair", phone: "+91 94470 77889", email: "meera.nair@example.com", nationality: "Indian", address: "Kochi, Kerala", idType: "aadhar", idNumber: "XXXX XXXX 1209" },
  { firstName: "Arjun", lastName: "Mehta", phone: "+91 98200 88990", nationality: "Indian", address: "Ahmedabad, Gujarat" },
  { firstName: "Fatima", lastName: "Khan", phone: "+91 98860 99001", nationality: "Indian", address: "Frazer Town, Bengaluru" },
];

type Plan = {
  guest: number;
  room: string;
  from: number; // days from today
  nights: number;
  status: "reserved" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  source: string;
  advance?: [number, string];
  settle?: string; // pay the remaining balance with this method at checkout
  charges?: Array<[string, string, number, number]>;
  discount?: number;
  notes?: string;
};

const DEMO_PLANS: Plan[] = [
  // Past stays (history for reports)
  { guest: 2, room: "401", from: -26, nights: 3, status: "checked_out", source: "booking_com", settle: "card", charges: [["food", "Dinner", 2, 650]] },
  { guest: 0, room: "201", from: -21, nights: 2, status: "checked_out", source: "corporate", settle: "bank_transfer" },
  { guest: 3, room: "103", from: -18, nights: 4, status: "checked_out", source: "makemytrip", advance: [3000, "upi"], settle: "upi", charges: [["laundry", "Laundry", 1, 350]] },
  { guest: 6, room: "301", from: -15, nights: 2, status: "checked_out", source: "walk_in", settle: "cash", discount: 500 },
  { guest: 7, room: "204", from: -12, nights: 3, status: "checked_out", source: "website", advance: [5000, "upi"], settle: "upi", charges: [["food", "Breakfast", 6, 250]] },
  { guest: 8, room: "202", from: -10, nights: 1, status: "no_show", source: "phone" },
  { guest: 4, room: "302", from: -9, nights: 3, status: "checked_out", source: "goibibo", settle: "card" },
  { guest: 9, room: "101", from: -7, nights: 2, status: "checked_out", source: "walk_in", settle: "cash" },
  { guest: 1, room: "301", from: -5, nights: 2, status: "checked_out", source: "phone", advance: [4000, "upi"], settle: "upi", charges: [["minibar", "Minibar", 1, 480]] },
  { guest: 5, room: "203", from: -4, nights: 3, status: "checked_out", source: "airbnb", advance: [6000, "card"] }, // still owes money
  // Guests staying now
  { guest: 0, room: "201", from: -2, nights: 4, status: "checked_in", source: "corporate", advance: [4000, "upi"], charges: [["food", "Room service dinner", 1, 820]], notes: "Business trip — needs GST invoice" },
  { guest: 2, room: "401", from: -1, nights: 1, status: "checked_in", source: "booking_com", advance: [9000, "card"] }, // leaving today
  { guest: 6, room: "103", from: -3, nights: 3, status: "checked_in", source: "walk_in" }, // leaving today, nothing paid yet
  { guest: 5, room: "302", from: 0, nights: 2, status: "checked_in", source: "website" },
  // Arriving today
  { guest: 7, room: "204", from: 0, nights: 2, status: "reserved", source: "phone", advance: [2000, "upi"], notes: "Arriving by evening train" },
  { guest: 3, room: "202", from: 0, nights: 1, status: "reserved", source: "makemytrip" },
  // Future bookings
  { guest: 4, room: "301", from: 2, nights: 3, status: "reserved", source: "website" },
  { guest: 8, room: "101", from: 3, nights: 2, status: "reserved", source: "walk_in" },
  { guest: 9, room: "401", from: 5, nights: 2, status: "reserved", source: "agoda", advance: [5000, "card"] },
  { guest: 1, room: "203", from: 6, nights: 4, status: "reserved", source: "phone" },
  { guest: 0, room: "201", from: 9, nights: 2, status: "cancelled", source: "corporate" },
];

async function seedDemo() {
  if ((await prisma.booking.count()) > 0) {
    console.log("Bookings already exist — skipping demo bookings.");
    return;
  }
  const hotelId = currentHotelId();
  const settings = await prisma.hotelSettings.findUniqueOrThrow({ where: { hotelId } });
  const today = todayKey(settings.timezone);
  const tax = { taxMode: settings.taxMode, taxRate: settings.taxRate, gstSlabs: parseGstSlabs(settings.gstSlabs), extrasTaxRate: settings.extrasTaxRate };

  await prisma.seasonalRate.create({
    data: { hotelId, name: "Year-end holidays", startDate: dateFromKey(`${today.slice(0, 4)}-12-24`), endDate: dateFromKey(`${today.slice(0, 4)}-12-31`), percent: 25 },
  });

  const guests = [];
  for (const g of DEMO_GUESTS) guests.push(await prisma.guest.create({ data: { hotelId, ...g } }));
  const rooms = Object.fromEntries((await prisma.room.findMany()).map((r) => [r.roomNumber, r]));
  const owner = await rawPrisma.staff.findUniqueOrThrow({ where: { email: "admin@hotel.com" } });

  for (const p of DEMO_PLANS) {
    const room = rooms[p.room];
    const checkIn = addDays(today, p.from);
    const checkOut = addDays(checkIn, p.nights);
    const at = (key: string, hour: number) => new Date(`${key}T${String(hour).padStart(2, "0")}:00:00+05:30`);

    const booking = await prisma.booking.create({
      data: {
        hotelId,
        number: await nextBookingNumber(),
        guestId: guests[p.guest].id,
        roomId: room.id,
        checkInDate: dateFromKey(checkIn),
        checkOutDate: dateFromKey(checkOut),
        status: p.status,
        source: p.source,
        ratePerNight: room.pricePerNight,
        discount: p.discount ?? 0,
        adults: Math.min(2, room.capacity),
        notes: p.notes ?? null,
        createdById: owner.id,
        createdAt: at(addDays(checkIn, -3), 10),
        actualCheckIn: p.status === "checked_in" || p.status === "checked_out" ? at(checkIn, 13) : null,
        actualCheckOut: p.status === "checked_out" ? at(checkOut, 10) : null,
        cancelReason: p.status === "cancelled" ? "Plans changed" : null,
      },
    });

    for (const [category, description, quantity, unitPrice] of p.charges ?? []) {
      await prisma.charge.create({
        data: { hotelId, bookingId: booking.id, category, description, quantity, unitPrice, amount: quantity * unitPrice, date: at(addDays(checkIn, 1), 20) },
      });
    }
    if (p.advance) {
      await prisma.payment.create({
        data: { hotelId, bookingId: booking.id, amount: p.advance[0], method: p.advance[1], type: "advance", receivedBy: owner.name, paidAt: at(addDays(checkIn, p.from >= 0 ? -1 : 0), 12) },
      });
    }

    if (p.status === "checked_out") {
      const nights = priceNights({ baseRate: room.pricePerNight, checkIn, checkOut, roomType: room.type, rules: { weekendSurcharge: 0, seasonalRates: [] } });
      const folio = computeFolio({
        nights,
        discount: p.discount ?? 0,
        charges: (p.charges ?? []).map(([, , q, u]) => ({ amount: q * u })),
        payments: p.advance ? [{ amount: p.advance[0], type: "advance" }] : [],
        tax,
      });
      await prisma.bill.create({
        data: {
          hotelId,
          bookingId: booking.id,
          invoiceNumber: `${settings.invoicePrefix}-${booking.number}`,
          roomCharges: folio.roomTotal,
          additionalCharges: folio.extrasTotal,
          discount: folio.discount,
          taxRate: folio.roomTaxRate,
          roomTax: folio.roomTax,
          extrasTax: folio.extrasTax,
          taxAmount: folio.taxTotal,
          totalAmount: folio.grandTotal,
          nights: folio.nightCount,
          generatedAt: at(checkOut, 10),
        },
      });
      if (p.settle && folio.balance > 0) {
        await prisma.payment.create({
          data: { hotelId, bookingId: booking.id, amount: folio.balance, method: p.settle, type: "balance", receivedBy: owner.name, paidAt: at(checkOut, 10) },
        });
      }
    }
  }

  // Keep room status in step with the demo stays.
  for (const room of Object.values(rooms)) {
    const inHouse = await prisma.booking.count({ where: { roomId: room.id, status: "checked_in" } });
    await prisma.room.update({ where: { id: room.id }, data: { status: inHouse ? "occupied" : "available" } });
  }
  await prisma.room.update({ where: { id: rooms["102"].id }, data: { status: "maintenance", housekeepingNotes: "AC being repaired" } });
  await prisma.room.update({ where: { id: rooms["203"].id }, data: { housekeeping: "dirty" } });
  await prisma.room.update({ where: { id: rooms["101"].id }, data: { housekeeping: "cleaning", houseKeeperName: "Lakshmi" } });

  await prisma.activityLog.create({ data: { hotelId, staffId: owner.id, staffName: owner.name, action: "Demo data loaded", details: `${DEMO_PLANS.length} bookings` } });
  console.log(`Demo data created: ${DEMO_GUESTS.length} guests, ${DEMO_PLANS.length} bookings.`);
}

async function main() {
  const hotel = await firstHotel();
  await runForHotel(hotel.id, async () => {
    await seedBasics();
    if (withDemo) await seedDemo();
  });
  console.log("Seed complete. Sign in with:");
  console.log("  Owner / manager: admin@hotel.com / admin123");
  console.log("  Front desk:      staff@hotel.com / staff123");
  console.log("Change these passwords in Settings → Staff after your first sign-in.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
