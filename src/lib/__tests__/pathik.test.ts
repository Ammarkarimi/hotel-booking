import { test } from "node:test";
import assert from "node:assert/strict";
import { countryOf, mobileFor, pathikRecord, splitName, type PathikInput } from "../pathik";

const hotel = { timezone: "Asia/Kolkata", checkInTime: "12:00", checkOutTime: "11:00" };
const guest: PathikInput["guest"] = {
  firstName: "Rajesh",
  lastName: "Kumar",
  phone: "+91 98450 11223",
  email: "rajesh@example.com",
  nationality: "Indian",
  company: "Kumar Traders",
  address: "12 MG Road",
  locality: "Indiranagar",
  city: "Bengaluru",
  district: "Bengaluru Urban",
  state: "Karnataka",
  pinCode: "560 038",
  dateOfBirth: new Date("1985-04-12T00:00:00Z"),
  idType: "driving_licence",
  idNumber: "KA01 2015 0012345",
  passportNo: null,
};
const booking: NonNullable<PathikInput["booking"]> = {
  number: 1023,
  roomNumber: "204",
  checkInDate: new Date("2026-11-03T00:00:00Z"),
  checkOutDate: new Date("2026-11-05T00:00:00Z"),
  actualCheckIn: new Date("2026-11-03T08:35:00Z"), // 2:05 pm in India
  actualCheckOut: null,
  adults: 3,
  children: 1,
  comingFrom: "Mumbai",
  goingTo: "Udaipur",
  vehicleNumber: "GJ01KP1788",
  vehicleType: "four_wheeler",
  companions: JSON.stringify([{ name: "Anita Kumar", phone: "9845011224" }, { name: "Ravi", aadhaarAtDesk: true }]),
};
// The desk ticked Anita's passport; Ravi said he would show his Aadhaar.
const idChecks = [{ person: "Anita Kumar", idType: "passport" }];
const base = (over: Partial<PathikInput> = {}): PathikInput => ({ guest, booking, idChecks, hotel, ...over });

test("names, mobiles and countries the way Pathik asks for them", () => {
  assert.deepEqual(splitName("Ravi Kumar Shah"), { firstName: "Ravi", middleName: "Kumar", lastName: "Shah" });
  assert.deepEqual(splitName("Ravi Kumar", "Shah"), { firstName: "Ravi", middleName: "Kumar", lastName: "Shah" });
  assert.deepEqual(splitName("Ravi"), { firstName: "Ravi", middleName: "", lastName: "" });
  assert.equal(mobileFor("+91 98450 11223", true), "9845011223");
  assert.equal(mobileFor("098450 11223", true), "9845011223");
  assert.equal(mobileFor("+1 555 0123", false), "+15550123");
  assert.equal(countryOf("Indian"), "India");
  assert.equal(countryOf("French"), "France");
  assert.equal(countryOf("Kenya"), "Kenya");
});

test("a booking becomes the whole Add Guest form, with the other adults", () => {
  const r = pathikRecord(base());
  assert.equal(r.title, "Booking #1023 · Room 204 · Rajesh Kumar");
  assert.equal(r.guest.mobile, "9845011223");
  assert.equal(r.guest.phone, "9845011223");
  assert.equal(r.guest.zipCode, "560038");
  assert.equal(r.guest.country, "India");
  assert.equal(r.guest.locality, "Indiranagar");
  assert.equal(r.guest.dateOfBirth, "1985-04-12");
  assert.equal(r.guest.docType, "driving_licence");
  assert.equal(r.guest.docNumber, "KA01 2015 0012345");
  assert.deepEqual(r.stay, {
    roomNumber: "204",
    checkInDate: "2026-11-03",
    checkInTime: "14:05",
    checkOutDate: "2026-11-05",
    checkOutTime: "11:00",
    adults: 3,
    children: 1,
    comingFrom: "Mumbai",
    goingTo: "Udaipur",
    vehicleType: "four_wheeler",
    vehicleNumber: "GJ01KP1788",
  });
  assert.deepEqual(
    r.others.map((o) => [o.firstName, o.lastName, o.mobile, o.docType]),
    [
      ["Anita", "Kumar", "9845011224", "passport"],
      ["Ravi", "", "", "aadhar"],
    ]
  );
  // No ID copies are kept: Aadhaar numbers and every ID photo are added in Pathik by hand.
  assert.ok(!("documents" in r));
  assert.deepEqual(r.byHand, ["Aadhaar number and photo for Ravi", "Rajesh Kumar's ID photo"]);
  assert.deepEqual(r.missing, []);
});

test("what is missing is listed, and a guest without a booking fills only their own details", () => {
  const r = pathikRecord(
    base({
      guest: { ...guest, lastName: "", district: null, email: null, idType: "aadhar", idNumber: null, dateOfBirth: null },
      booking: { ...booking, adults: 4, goingTo: null, vehicleType: null },
      idChecks: [],
    })
  );
  assert.deepEqual(r.missing, ["Last name (surname)", "District", "Date of birth", "Email", "Going to", "How the guest travels (vehicle type)", "Names of the other adult", "ID proof type of Anita Kumar"]);
  assert.deepEqual(r.byHand, ["Aadhaar number and photo for Rajesh, Ravi"]);
  assert.equal(r.guest.docNumber, "");

  const only = pathikRecord(base({ booking: undefined }));
  assert.equal(only.stay, null);
  assert.deepEqual(only.others, []);
  assert.equal(only.title, "Rajesh Kumar");
  // A guest whose ID type is not saved: the type ticked at the desk is used.
  const ticked = pathikRecord(base({ guest: { ...guest, idType: null, idNumber: null, passportNo: "X1234567" }, idChecks: [{ person: null, idType: "passport" }] }));
  assert.equal(ticked.guest.docType, "passport");
  assert.equal(ticked.guest.docNumber, "X1234567");
  // Only the kind of ID was ticked at the desk: its number is typed in Pathik, and nothing is "missing".
  const noNumber = pathikRecord(base({ guest: { ...guest, idType: "driving_licence", idNumber: null } }));
  assert.ok(!noNumber.missing.some((m) => /number|copy/i.test(m)));
  assert.deepEqual(noNumber.byHand, ["Aadhaar number and photo for Ravi", "Rajesh Kumar's ID number and photo"]);
});
