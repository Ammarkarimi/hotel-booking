"use client";

import { useEffect, useState } from "react";
import { CreditCard, Receipt, IndianRupee } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Modal,
  Input,
  Label,
  Select,
  Badge,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  getPaymentStatus,
  PAYMENT_METHODS,
} from "@/lib/utils";

interface Payment {
  id: string;
  amount: number;
  method: string;
  type: string;
  paidAt: string;
}

interface Bill {
  id: string;
  roomCharges: number;
  additionalCharges: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  nights: number;
  generatedAt: string;
}

interface Booking {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { firstName: string; lastName: string };
  room: { roomNumber: string; type: string; pricePerNight: number };
  payments: Payment[];
  bill: Bill | null;
}

export default function BillingClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    type: "advance",
    notes: "",
  });
  const [billForm, setBillForm] = useState({
    additionalCharges: "0",
    discount: "0",
    taxRate: "12",
  });

  async function loadBookings() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data);
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  function openPaymentModal(booking: Booking) {
    setSelectedBooking(booking);
    const total = booking.bill?.totalAmount || booking.room.pricePerNight;
    const paid = booking.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, total - paid);
    setPaymentForm({
      amount: String(remaining || booking.room.pricePerNight),
      method: "cash",
      type: paid > 0 ? "balance" : "advance",
      notes: "",
    });
    setPaymentModal(true);
  }

  function openBillModal(booking: Booking) {
    setSelectedBooking(booking);
    setBillForm({ additionalCharges: "0", discount: "0", taxRate: "12" });
    setBillModal(true);
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking) return;

    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: selectedBooking.id,
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
      }),
    });

    setPaymentModal(false);
    loadBookings();
  }

  async function handleGenerateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking) return;

    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: selectedBooking.id,
        ...billForm,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }

    setBillModal(false);
    loadBookings();
  }

  function getPaymentBadge(booking: Booking) {
    const paid = booking.payments.reduce((s, p) => s + p.amount, 0);
    const total = booking.bill?.totalAmount || 0;
    if (!booking.bill && paid === 0) return { variant: "warning", label: "No bill" };
    const status = getPaymentStatus(total || paid, paid);
    const variants = { pending: "danger", partial: "warning", paid: "success" };
    return { variant: variants[status], label: status };
  }

  if (loading) return <div className="text-slate-500">Loading billing data...</div>;

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Payments</h1>
        <p className="text-slate-500">Generate bills, record payments, and track balances</p>
      </div>

      <div className="space-y-4">
        {activeBookings.map((booking) => {
          const paid = booking.payments.reduce((s, p) => s + p.amount, 0);
          const total = booking.bill?.totalAmount || 0;
          const remaining = Math.max(0, total - paid);
          const paymentBadge = getPaymentBadge(booking);

          return (
            <Card key={booking.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {booking.guest.firstName} {booking.guest.lastName}
                      </h3>
                      <Badge variant={booking.status === "checked_in" ? "occupied" : "default"}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                      <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Room {booking.room.roomNumber} ({booking.room.type}) ·{" "}
                      {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                    </p>

                    {booking.bill ? (
                      <div className="mt-3 rounded-lg bg-slate-50 p-4">
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-slate-500">Room Charges</p>
                            <p className="font-medium">{formatCurrency(booking.bill.roomCharges)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Tax ({booking.bill.taxRate}%)</p>
                            <p className="font-medium">{formatCurrency(booking.bill.taxAmount)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Total</p>
                            <p className="font-bold text-primary-600">
                              {formatCurrency(booking.bill.totalAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Balance Due</p>
                            <p className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                              {formatCurrency(remaining)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-amber-600">Bill not generated yet</p>
                    )}

                    {booking.payments.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium text-slate-500">Payment History</p>
                        <div className="space-y-1">
                          {booking.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm">
                              <span className="capitalize text-slate-600">
                                {p.type} via {p.method}
                              </span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {!booking.bill && (
                      <Button variant="secondary" onClick={() => openBillModal(booking)}>
                        <Receipt className="h-4 w-4" />
                        Generate Bill
                      </Button>
                    )}
                    <Button onClick={() => openPaymentModal(booking)}>
                      <CreditCard className="h-4 w-4" />
                      Record Payment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Record Payment">
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Payment Type</Label>
            <Select
              value={paymentForm.type}
              onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
            >
              <option value="advance">Advance</option>
              <option value="balance">Balance</option>
              <option value="full">Full Payment</option>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setPaymentModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              <IndianRupee className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={billModal} onClose={() => setBillModal(false)} title="Generate Bill">
        <form onSubmit={handleGenerateBill} className="space-y-4">
          <div>
            <Label>Additional Charges (₹)</Label>
            <Input
              type="number"
              min="0"
              value={billForm.additionalCharges}
              onChange={(e) => setBillForm({ ...billForm, additionalCharges: e.target.value })}
            />
          </div>
          <div>
            <Label>Discount (₹)</Label>
            <Input
              type="number"
              min="0"
              value={billForm.discount}
              onChange={(e) => setBillForm({ ...billForm, discount: e.target.value })}
            />
          </div>
          <div>
            <Label>Tax Rate (%)</Label>
            <Input
              type="number"
              min="0"
              value={billForm.taxRate}
              onChange={(e) => setBillForm({ ...billForm, taxRate: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setBillModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Generate Bill
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
