"use client";

import { useEffect, useState } from "react";
import {
  BedDouble,
  Users,
  IndianRupee,
  TrendingUp,
  Wrench,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatCard, Card, CardHeader, CardContent, Badge } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Analytics {
  summary: {
    totalRooms: number;
    occupied: number;
    available: number;
    maintenance: number;
    reserved: number;
    occupancyRate: number;
    totalRevenue: number;
    todayRevenue: number;
    activeBookings: number;
    pendingPayments: number;
    totalBills: number;
  };
  revenueByRoomType: Record<string, number>;
  roomStatusOverview: Array<{
    roomNumber: string;
    type: string;
    status: string;
    pricePerNight: number;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    method: string;
    paidAt: string;
    booking: {
      guest: { firstName: string; lastName: string };
      room: { roomNumber: string };
    };
  }>;
}

const PIE_COLORS = ["#22c55e", "#a855f7", "#f97316", "#eab308"];

export default function DashboardClient() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-red-500">Failed to load analytics</div>;
  }

  const { summary, revenueByRoomType, roomStatusOverview, recentPayments } = data;

  const occupancyData = [
    { name: "Occupied", value: summary.occupied },
    { name: "Available", value: summary.available },
    { name: "Maintenance", value: summary.maintenance },
    { name: "Reserved", value: summary.reserved },
  ].filter((d) => d.value > 0);

  const revenueData = Object.entries(revenueByRoomType).map(([type, revenue]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    revenue,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Hotel occupancy and revenue overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Occupancy Rate"
          value={`${summary.occupancyRate}%`}
          subtitle={`${summary.occupied} of ${summary.totalRooms} rooms`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Active Bookings"
          value={summary.activeBookings}
          subtitle="Currently checked in"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          subtitle={`Today: ${formatCurrency(summary.todayRevenue)}`}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          title="Available Rooms"
          value={summary.available}
          subtitle={`${summary.maintenance} in maintenance`}
          icon={<BedDouble className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Room Occupancy</h2>
          </CardHeader>
          <CardContent>
            {occupancyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={occupancyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {occupancyData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-slate-500">No room data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Revenue by Room Type</h2>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-slate-500">No revenue data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Room Status Overview</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roomStatusOverview.map((room) => (
                <div
                  key={room.roomNumber}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-slate-900">
                      {room.roomNumber}
                    </span>
                    <span className="text-sm capitalize text-slate-500">{room.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      {formatCurrency(room.pricePerNight)}/night
                    </span>
                    <Badge variant={room.status}>{room.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Recent Payments</h2>
          </CardHeader>
          <CardContent>
            {recentPayments.length > 0 ? (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {payment.booking.guest.firstName} {payment.booking.guest.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Room {payment.booking.room.roomNumber} · {payment.method.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(payment.paidAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-500">No payments yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{summary.totalBills}</p>
              <p className="text-sm text-slate-500">Bills Generated</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <IndianRupee className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{summary.pendingPayments}</p>
              <p className="text-sm text-slate-500">Pending Balances</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <Wrench className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{summary.maintenance}</p>
              <p className="text-sm text-slate-500">Under Maintenance</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
