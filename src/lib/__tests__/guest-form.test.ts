import { test } from "node:test";
import assert from "node:assert/strict";
import { formMessage, formStatus, fullAddress, guestFormSchema, missingDocuments, parseCompanions } from "../guest-form";

const filled = {
  firstName: "Asha",
  lastName: "Rao",
  phone: "98765 43210",
  dateOfBirth: "1990-04-12",
  nationality: "Indian",
  address: "12 MG Road, Navrangpura",
  city: "Ahmedabad",
  state: "Gujarat",
  pinCode: "380 009",
  checkIn: "2026-11-03",
  checkOut: "2026-11-05",
  adults: 2,
  children: 1,
  comingFrom: "Mumbai",
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
  assert.match(fail({ checkOut: "2026-11-03" }), /after the arrival date/);
  assert.match(fail({ consent: false }), /agree/);
  // A foreign guest has no Indian state or PIN code.
  assert.equal(guestFormSchema.safeParse({ ...filled, nationality: "British", state: "", pinCode: "SW1A 1AA" }).success, true);
});

test("every adult needs an ID copy, and a foreign guest a passport", () => {
  const details = guestFormSchema.parse(filled);
  assert.deepEqual(missingDocuments(details, []), ["Please upload an ID proof for Asha", "Please upload an ID proof for Ravi Rao"]);
  assert.deepEqual(missingDocuments(details, [{ person: "0", type: "aadhar" }, { person: "1", type: "driving_licence" }]), []);
  const foreign = { ...details, nationality: "British", companions: [] };
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
