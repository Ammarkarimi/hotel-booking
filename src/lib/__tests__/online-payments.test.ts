import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { amountToPay, isUpiId, linkReference, methodFromRazorpay, onlinePaymentWays, paymentsToRecord, payPagePath, upiPayLink } from "../online-payments";
import { verifyCallback } from "../razorpay";
import { openSecret, sealSecret } from "../secret-box";
import { razorpayContact } from "../payment-links";

test("UPI IDs, and which ways of paying online are set up", () => {
  assert.equal(isUpiId("sunrise@okaxis"), true);
  assert.equal(isUpiId("9876543210@ybl"), true);
  assert.equal(isUpiId("sunrise"), false);
  assert.equal(isUpiId("@okaxis"), false);
  assert.equal(isUpiId("sun rise@okaxis"), false);
  assert.deepEqual(onlinePaymentWays({ hotelName: "H", upiId: "hotel@okaxis" }), { upi: true, razorpay: false, any: true });
  assert.deepEqual(onlinePaymentWays({ hotelName: "H", razorpayKeyId: "rzp_live_x", razorpayKeySecret: true }), { upi: false, razorpay: true, any: true });
  assert.deepEqual(onlinePaymentWays({ hotelName: "H", razorpayKeyId: "rzp_live_x" }), { upi: false, razorpay: false, any: false });
});

test("the amount a payment page asks for: an advance below the balance, otherwise the balance", () => {
  assert.equal(amountToPay(8080), 8080);
  assert.equal(amountToPay(8080, "2000"), 2000);
  assert.equal(amountToPay(8080, "9000"), 8080); // never more than is due
  assert.equal(amountToPay(8080, "0.5"), 8080);
  assert.equal(amountToPay(8080, "abc"), 8080);
  assert.equal(amountToPay(0.4, "100"), 0);
  assert.equal(amountToPay(-50), 0);
  assert.equal(payPagePath("tok"), "/pay/tok");
  assert.equal(payPagePath("tok", 2000), "/pay/tok?a=2000");
});

test("the UPI link has the hotel's ID, the amount in rupees and a short note", () => {
  const link = upiPayLink({ upiId: "sunrise@okaxis", name: "Sunrise Residency", amount: 8080, note: "Booking 1022, Sunrise Residency" });
  assert.equal(link, "upi://pay?pa=sunrise%40okaxis&pn=Sunrise%20Residency&am=8080.00&cu=INR&tn=Booking%201022%2C%20Sunrise%20Residency");
});

test("Razorpay payments: method names, only captured payments not yet written down, references", () => {
  assert.equal(methodFromRazorpay("upi"), "upi");
  assert.equal(methodFromRazorpay("card"), "card");
  assert.equal(methodFromRazorpay("netbanking"), "bank_transfer");
  assert.equal(methodFromRazorpay("wallet"), "other");
  const payments = [
    { payment_id: "pay_1", amount: 200000, method: "upi", status: "captured", created_at: 1 },
    { payment_id: "pay_2", amount: 100, method: "card", status: "failed", created_at: 2 },
    { payment_id: "pay_3", amount: 50000, method: "card", status: "captured", created_at: 3 },
  ];
  assert.deepEqual(paymentsToRecord(payments, ["pay_3", null]).map((p) => p.payment_id), ["pay_1"]);
  assert.deepEqual(paymentsToRecord(null, []), []);
  assert.equal(linkReference(1022, "ab12cd34"), "B1022-ab12cd34");
  assert.equal(razorpayContact("98765 43210"), "+919876543210");
  assert.equal(razorpayContact("+91 98765 43210"), "+919876543210");
  assert.equal(razorpayContact("123"), undefined);
});

test("the return from Razorpay is trusted only with the right signature", () => {
  const secret = "test_secret";
  const q = { linkId: "plink_1", reference: "B1022-ab", status: "paid", paymentId: "pay_1" };
  const signature = createHmac("sha256", secret).update("plink_1|B1022-ab|paid|pay_1").digest("hex");
  assert.equal(verifyCallback(secret, { ...q, signature }), true);
  assert.equal(verifyCallback(secret, { ...q, status: "created", signature }), false);
  assert.equal(verifyCallback("other", { ...q, signature }), false);
  assert.equal(verifyCallback(secret, { ...q, signature: "" }), false);
});

test("the Razorpay secret is stored locked and opens again with the same key", () => {
  const sealed = sealSecret("abc123secret");
  assert.notEqual(sealed, "abc123secret");
  assert.doesNotMatch(sealed, /abc123secret/);
  assert.equal(openSecret(sealed), "abc123secret");
  assert.notEqual(sealSecret("abc123secret"), sealed); // a fresh IV every time
  assert.equal(openSecret(sealed.slice(0, -2) + "xx"), null);
  assert.equal(openSecret("garbage"), null);
  assert.equal(openSecret(null), null);
});
