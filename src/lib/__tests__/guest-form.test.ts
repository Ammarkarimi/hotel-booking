import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDetails, deskPathikMissing, formMessage, formStatus, fullAddress, guestFormSchema, missingDocuments, parseCompanions, staffFormSchema } from "../guest-form";

const filled = {
  firstName: "Asha",
  lastName: "Rao",
  phone: "98765 43210",
  dateOfBirth: "1990-04-12",
  nationality: "Indian",
  address: "12 MG Road",
  locality: "Navrangpura",
  city: "Ahmedabad",
  district: "Ahmedabad",
  state: "Gujarat",
  pinCode: "380 009",
  checkIn: "2026-11-03",
  checkOut: "2026-11-05",
  adults: 2,
  children: 1,
  comingFrom: "Mumbai",
  goingTo: "Udaipur",
  vehicleType: "bus",
  companions: [{ name: "Ravi Rao" }],
  consent: true,
};

test("the guest form needs every adult's name, a state and PIN for Indian guests, and agreement", () => {
  assert.equal(guestFormSchema.safeParse(filled).success, true);
  const fail = (change: object) => {
    const r = guestFormSchema.safeParse({ ...filled, ...change });
    return r.success ? "" : r.error.issues[0].message;
  };
  assert.match(fail({ companions: [] }), /each adult staying with you/);
  assert.match(fail({ pinCode: "3800" }), /6-digit PIN/);
  assert.match(fail({ state: "" }), /state/);
  assert.match(fail({ district: "" }), /district/);
  // The police register (Pathik) also asks for the locality, the next city and how the guest travels.
  assert.match(fail({ locality: "" }), /locality/);
  assert.match(fail({ goingTo: "" }), /going to next/);
  assert.match(fail({ vehicleType: "" }), /how you are travelling/);
  // The desk can save a form without them.
  assert.equal(staffFormSchema.safeParse({ ...filled, goingTo: "", vehicleType: "", locality: "" }).success, true);
  assert.match(fail({ checkOut: "2026-11-03" }), /after the arrival date/);
  assert.match(fail({ consent: false }), /agree/);
  // A foreign guest has no Indian state or PIN code.
  assert.equal(guestFormSchema.safeParse({ ...filled, nationality: "British", state: "", locality: "", district: "", pinCode: "SW1A 1AA" }).success, true);
});

test("every adult shows an Aadhaar at check-in or uploads another ID, and a foreign guest a passport", () => {
  const details = guestFormSchema.parse(filled);
  assert.deepEqual(missingDocuments(details, []), ["Please upload an ID proof for Asha, or choose Aadhaar", "Please upload an ID proof for Ravi Rao, or choose Aadhaar"]);
  assert.deepEqual(missingDocuments(details, [{ person: "0", type: "voter_id" }, { person: "1", type: "driving_licence" }]), []);
  // Aadhaar at the desk: nothing to upload.
  assert.deepEqual(missingDocuments({ ...details, aadhaarAtDesk: true, companions: [{ name: "Ravi Rao", aadhaarAtDesk: true }] }, []), []);
  const foreign = { ...details, nationality: "British", aadhaarAtDesk: true, companions: [] };
  assert.deepEqual(missingDocuments(foreign, [{ person: "0", type: "visa" }]), ["Please upload a copy of your passport"]);
  assert.deepEqual(missingDocuments(foreign, [{ person: "0", type: "passport" }]), []);
});

test("the WhatsApp message carries the link, and an old link expires", () => {
  const text = formMessage({ hotelName: "Sunrise Residency", guestName: "Asha Rao", url: "https://x.in/form/abc" });
  assert.match(text, /^Hello Asha, thank you for choosing Sunrise Residency/);
  assert.match(text, /https:\/\/x\.in\/form\/abc/);
  assert.equal(formStatus({ status: "sent", expiresAt: "2026-11-01T00:00:00Z" }, new Date("2026-11-02T00:00:00Z")), "expired");
  assert.equal(formStatus({ status: "submitted", expiresAt: "2026-11-01T00:00:00Z" }, new Date("2026-11-02T00:00:00Z")), "submitted");
  assert.equal(fullAddress({ address: "12 MG Road", city: "Ahmedabad", state: "Gujarat", pinCode: "380009" }), "12 MG Road, Ahmedabad, Gujarat 380009");
  assert.deepEqual(parseCompanions('[{"name":"Ravi"}]'), [{ name: "Ravi" }]);
  assert.deepEqual(parseCompanions("oops"), []);
});

test("the front desk can correct the details with the same checks, without the agreement box", () => {
  const { consent: _consent, ...details } = filled;
  assert.equal(staffFormSchema.safeParse(details).success, true);
  const r = staffFormSchema.safeParse({ ...details, adults: 3, companions: [{ name: "Ravi Rao" }, { name: "ravi rao " }] });
  assert.equal(r.success, false);
  assert.match(r.success ? "" : r.error.issues[0].message, /same name/);
  assert.equal(staffFormSchema.safeParse({ ...details, adults: 1 }).success, false);
  // Saved without spaces in the PIN, and a foreign guest never "shows Aadhaar".
  const saved = cleanDetails(staffFormSchema.parse({ ...details, nationality: "British", state: "", aadhaarAtDesk: true }));
  assert.equal(saved.pinCode, "380009");
  assert.equal(saved.aadhaarAtDesk, false);
});

test("a desk booking lists what Pathik still needs, and nothing once all is filled in", () => {
  const full = {
    lastName: "Karimi", phone: "9898485698", email: "a@b.in", nationality: "Indian", address: "12 Kalupur Road", locality: "Panchpatti",
    city: "Ahmedabad", district: "Ahmedabad", state: "Gujarat", pinCode: "380 001", dateOfBirth: "1992-05-14",
    comingFrom: "Surat", goingTo: "Udaipur", vehicleType: "bus", adults: 2, companions: [{ name: "Sana Karimi" }],
  };
  assert.deepEqual(deskPathikMissing(full), []);
  assert.deepEqual(deskPathikMissing({ ...full, lastName: " ", pinCode: "3800", companions: [] }), ["Last name", "6-digit PIN code", "Full name of adult 2"]);
  // A foreign guest has no Indian locality, district, state or PIN code.
  assert.deepEqual(deskPathikMissing({ ...full, nationality: "British", locality: "", district: "", state: "", pinCode: "" }), []);
});
