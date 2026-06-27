import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { parseAmenities } from "@/lib/utils";

export async function GET() {
  return withAuth(async () => {
    const rooms = await prisma.room.findMany();
    const bookings = await prisma.booking.findMany({
      include: { payments: true, bill: true, room: true },
    });
    const payments = await prisma.payment.findMany({
      where: { status: "completed" },
    });
    const bills = await prisma.bill.findMany();

    const totalRooms = rooms.length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const available = rooms.filter((r) => r.status === "available").length;
    const maintenance = rooms.filter((r) => r.status === "maintenance").length;
    const reserved = rooms.filter((r) => r.status === "reserved").length;
    const occupancyRate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0;

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const todayRevenue = payments
      .filter((p) => {
        const today = new Date();
        const paid = new Date(p.paidAt);
        return (
          paid.getDate() === today.getDate() &&
          paid.getMonth() === today.getMonth() &&
          paid.getFullYear() === today.getFullYear()
        );
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const activeBookings = bookings.filter((b) => b.status === "checked_in").length;
    const pendingPayments = bookings.filter((b) => {
      if (!b.bill) return false;
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      return paid < b.bill.totalAmount;
    }).length;

    const revenueByRoomType: Record<string, number> = {};
    for (const bill of bills) {
      const booking = bookings.find((b) => b.id === bill.bookingId);
      if (booking) {
        const type = booking.room.type;
        revenueByRoomType[type] = (revenueByRoomType[type] || 0) + bill.totalAmount;
      }
    }

    const roomStatusOverview = rooms.map((r) => ({
      roomNumber: r.roomNumber,
      type: r.type,
      status: r.status,
      pricePerNight: r.pricePerNight,
      amenities: parseAmenities(r.amenities),
    }));

    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { paidAt: "desc" },
      include: {
        booking: { include: { guest: true, room: true } },
      },
    });

    return NextResponse.json({
      summary: {
        totalRooms,
        occupied,
        available,
        maintenance,
        reserved,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalRevenue,
        todayRevenue,
        activeBookings,
        pendingPayments,
        totalBills: bills.length,
      },
      revenueByRoomType,
      roomStatusOverview,
      recentPayments,
    });
  });
}
