import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.staff.upsert({
    where: { email: "admin@hotel.com" },
    update: {},
    create: {
      email: "admin@hotel.com",
      passwordHash,
      name: "Hotel Admin",
      role: "admin",
    },
  });

  await prisma.staff.upsert({
    where: { email: "staff@hotel.com" },
    update: {},
    create: {
      email: "staff@hotel.com",
      passwordHash: await bcrypt.hash("staff123", 10),
      name: "Front Desk Staff",
      role: "staff",
    },
  });

  const rooms = [
    { roomNumber: "101", type: "single", pricePerNight: 2500, amenities: JSON.stringify(["WiFi", "AC", "TV"]), status: "available" },
    { roomNumber: "102", type: "single", pricePerNight: 2500, amenities: JSON.stringify(["WiFi", "AC", "TV"]), status: "available" },
    { roomNumber: "201", type: "double", pricePerNight: 4000, amenities: JSON.stringify(["WiFi", "AC", "TV", "Mini Bar"]), status: "available" },
    { roomNumber: "202", type: "double", pricePerNight: 4000, amenities: JSON.stringify(["WiFi", "AC", "TV", "Mini Bar"]), status: "available" },
    { roomNumber: "301", type: "suite", pricePerNight: 8000, amenities: JSON.stringify(["WiFi", "AC", "TV", "Mini Bar", "Jacuzzi", "Balcony"]), status: "available" },
    { roomNumber: "302", type: "deluxe", pricePerNight: 6000, amenities: JSON.stringify(["WiFi", "AC", "TV", "Mini Bar", "Balcony"]), status: "maintenance" },
    { roomNumber: "401", type: "family", pricePerNight: 5500, amenities: JSON.stringify(["WiFi", "AC", "TV", "Extra Bed"]), status: "available" },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: room,
      create: room,
    });
  }

  const guest1 = await prisma.guest.upsert({
    where: { id: "seed-guest-1" },
    update: {},
    create: {
      id: "seed-guest-1",
      firstName: "Rajesh",
      lastName: "Kumar",
      email: "rajesh.kumar@email.com",
      phone: "+91 9876543210",
      nationality: "Indian",
      address: "12 MG Road, Bangalore",
    },
  });

  const guest2 = await prisma.guest.upsert({
    where: { id: "seed-guest-2" },
    update: {},
    create: {
      id: "seed-guest-2",
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@email.com",
      phone: "+1 555-0123",
      nationality: "American",
      address: "456 Oak Ave, New York",
    },
  });

  const room201 = await prisma.room.findUnique({ where: { roomNumber: "201" } });
  const room301 = await prisma.room.findUnique({ where: { roomNumber: "301" } });

  if (room201) {
    const checkIn = new Date();
    checkIn.setHours(14, 0, 0, 0);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);
    checkOut.setHours(11, 0, 0, 0);

    const booking1 = await prisma.booking.upsert({
      where: { id: "seed-booking-1" },
      update: {},
      create: {
        id: "seed-booking-1",
        guestId: guest1.id,
        roomId: room201.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        actualCheckIn: checkIn,
        status: "checked_in",
        adults: 2,
        notes: "Business trip",
      },
    });

    await prisma.room.update({
      where: { id: room201.id },
      data: { status: "occupied" },
    });

    await prisma.payment.upsert({
      where: { id: "seed-payment-1" },
      update: {},
      create: {
        id: "seed-payment-1",
        bookingId: booking1.id,
        amount: 4000,
        method: "upi",
        type: "advance",
        status: "completed",
      },
    });
  }

  if (room301) {
    const pastCheckIn = new Date();
    pastCheckIn.setDate(pastCheckIn.getDate() - 5);
    const pastCheckOut = new Date();
    pastCheckOut.setDate(pastCheckOut.getDate() - 2);

    const booking2 = await prisma.booking.upsert({
      where: { id: "seed-booking-2" },
      update: {},
      create: {
        id: "seed-booking-2",
        guestId: guest2.id,
        roomId: room301.id,
        checkInDate: pastCheckIn,
        checkOutDate: pastCheckOut,
        actualCheckIn: pastCheckIn,
        actualCheckOut: pastCheckOut,
        status: "checked_out",
        adults: 1,
      },
    });

    const nights = 3;
    const roomCharges = 8000 * nights;
    const taxAmount = roomCharges * 0.12;
    const totalAmount = roomCharges + taxAmount;

    await prisma.bill.upsert({
      where: { bookingId: booking2.id },
      update: {},
      create: {
        bookingId: booking2.id,
        roomCharges,
        taxRate: 12,
        taxAmount,
        totalAmount,
        nights,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        amount: 10000,
        method: "card",
        type: "advance",
        status: "completed",
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        amount: 16840 - 10000,
        method: "card",
        type: "balance",
        status: "completed",
      },
    });
  }

  console.log("Seed data created successfully!");
  console.log("Default credentials:");
  console.log("  Admin: admin@hotel.com / admin123");
  console.log("  Staff: staff@hotel.com / staff123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
