import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ariHash,
  buildAri,
  channexGroupId,
  mapRevision,
  nationalityFromCountry,
  parseRoomMap,
  propertyPayload,
  ratePlanPayload,
  roomTypeSpecs,
  sameSecret,
  sellingRate,
  stayDates,
  webhookSecret,
  type MapRoom,
} from "../channex-map";
import type { ChannexRevision } from "../channex";

const rooms: MapRoom[] = [
  { id: "d1", type: "double", capacity: 2, pricePerNight: 3200, status: "available" },
  { id: "d2", type: "double", capacity: 3, pricePerNight: 3000, status: "occupied" },
  { id: "d3", type: "double", capacity: 2, pricePerNight: 2500, status: "maintenance" },
  { id: "s1", type: "single", capacity: 1, pricePerNight: 1800, status: "maintenance" },
];
const map = { double: { roomTypeId: "rt-d", ratePlanId: "rp-d" }, single: { roomTypeId: "rt-s", ratePlanId: "rp-s" } };
const noRules = { weekendSurcharge: 0, seasonalRates: [] };

test("one Channex room type per kind of room: rooms not under repair, biggest capacity, lowest usable price", () => {
  const [double, single] = roomTypeSpecs(rooms);
  assert.deepEqual(double, { type: "double", title: "Double room", rooms: 2, countOfRooms: 2, occAdults: 3, defaultOccupancy: 2, basePrice: 3000 });
  // Every room under repair: Channex still needs one room, and nothing is free.
  assert.equal(single.rooms, 0);
  assert.equal(single.countOfRooms, 1);
  assert.equal(single.defaultOccupancy, 1);
  const plan = ratePlanPayload("p", "rt-d", double, "inr", 10);
  assert.deepEqual(plan.options, [{ occupancy: 3, is_primary: true, rate: "3300.00" }]);
  assert.equal(plan.currency, "INR");
  assert.equal(plan.sell_mode, "per_room");
});

test("the property is made from the hotel's settings, leaving out what is empty or wrong", () => {
  const p = propertyPayload({ hotelName: "Sunrise", currency: "INR", timezone: "Asia/Kolkata", email: "not an email", phone: " +91 98765 43210 ", address: "", city: "Pune" });
  assert.deepEqual(p, { title: "Sunrise", currency: "INR", timezone: "Asia/Kolkata", property_type: "hotel", phone: "+91 98765 43210", city: "Pune", country: "IN" });
});

test("prices: weekend and season %, then the markup, in whole rupees", () => {
  assert.equal(sellingRate(3000, 20, 15, "INR"), 4140);
  assert.equal(sellingRate(2999, 0, 7.5, "INR"), 3224);
  assert.equal(sellingRate(99.99, 0, 10, "USD"), 109.99);
});

test("a guest still in the room after the leaving date holds it until tomorrow", () => {
  const stays = stayDates(
    [
      { roomId: "a", status: "checked_in", checkInDate: "2026-11-08", checkOutDate: "2026-11-10" },
      { roomId: "b", status: "reserved", checkInDate: "2026-11-12", checkOutDate: "2026-11-14" },
      { roomId: "c", status: "cancelled", checkInDate: "2026-11-12", checkOutDate: "2026-11-14" },
    ],
    "2026-11-12"
  );
  assert.deepEqual(stays, [
    { roomId: "a", checkIn: "2026-11-08", checkOut: "2026-11-13" },
    { roomId: "b", checkIn: "2026-11-12", checkOut: "2026-11-14" },
  ]);
});

test("free rooms and prices are joined into date ranges, one list each, and the hash follows them", () => {
  const ari = buildAri({
    propertyId: "p",
    roomMap: map,
    rooms,
    stays: [{ roomId: "d1", checkIn: "2026-11-13", checkOut: "2026-11-15" }],
    rules: { weekendSurcharge: 10, seasonalRates: [] },
    markup: 0,
    currency: "INR",
    today: "2026-11-12", // a Thursday
    days: 5,
  });
  assert.deepEqual(
    ari.availability.filter((v) => v.room_type_id === "rt-d").map((v) => [v.date_from, v.date_to, v.availability]),
    [
      ["2026-11-12", "2026-11-12", 2],
      ["2026-11-13", "2026-11-14", 1],
      ["2026-11-15", "2026-11-16", 2],
    ]
  );
  assert.deepEqual(ari.availability.filter((v) => v.room_type_id === "rt-s").map((v) => v.availability), [0]);
  // Friday 13th and Saturday 14th are the weekend.
  assert.deepEqual(
    ari.restrictions.filter((v) => v.rate_plan_id === "rp-d").map((v) => [v.date_from, v.date_to, v.rate]),
    [
      ["2026-11-12", "2026-11-12", "3000.00"],
      ["2026-11-13", "2026-11-14", "3300.00"],
      ["2026-11-15", "2026-11-16", "3000.00"],
    ]
  );
  assert.equal(ari.tonight.double, 3000);
  const again = buildAri({ propertyId: "p", roomMap: map, rooms, stays: [], rules: noRules, markup: 0, currency: "INR", today: "2026-11-12", days: 5 });
  assert.notEqual(ariHash(ari), ariHash(again));
  assert.equal(ariHash(again), ariHash(buildAri({ propertyId: "p", roomMap: map, rooms, stays: [], rules: noRules, markup: 0, currency: "INR", today: "2026-11-12", days: 5 })));
});

test("a broken or half-made room map is read safely", () => {
  assert.deepEqual(parseRoomMap("not json"), {});
  assert.deepEqual(parseRoomMap('{"double":{"roomTypeId":"x"},"bad":{"ratePlanId":"y"}}'), { double: { roomTypeId: "x", ratePlanId: "" } });
});

const revision: ChannexRevision = {
  id: "rev1",
  booking_id: "bk1",
  property_id: "p",
  status: "new",
  ota_name: "Booking.com",
  ota_reservation_code: "4455",
  arrival_date: "2026-11-20",
  departure_date: "2026-11-22",
  amount: "6100.00",
  currency: "INR",
  notes: "Late arrival",
  payment_collect: "ota",
  customer: { name: "Rahul", surname: "Sharma", mail: "r@example.com", phone: "+91 90000 00000", city: "Delhi", zip: "110001", country: "IN" },
  rooms: [
    { room_type_id: "rt-d", rate_plan_id: "rp-d", checkin_date: "2026-11-20", checkout_date: "2026-11-22", amount: "6100.00", days: { "2026-11-20": "3000.00", "2026-11-21": "3100.00" }, occupancy: { adults: 2, children: 1, infants: 0 } },
  ],
};

test("a booking from a site becomes one stay per room, with guest, price and money already paid", () => {
  const m = mapRevision(revision, map);
  assert.equal(m.status, "new");
  assert.equal(m.unmapped.length, 0);
  assert.deepEqual(m.refs, ["channex:bk1:0"]);
  const s = m.stays[0];
  assert.equal(s.source, "booking_com");
  assert.equal(s.roomType, "double");
  assert.equal(s.ratePerNight, 3050);
  assert.equal(s.prepaid, 6100);
  assert.equal(s.adults, 2);
  assert.equal(s.children, 1);
  assert.equal(s.otaReference, "4455");
  assert.equal(s.groupId, null);
  assert.deepEqual(s.guest, { firstName: "Rahul", lastName: "Sharma", phone: "+91 90000 00000", email: "r@example.com", address: null, city: "Delhi", state: null, pinCode: "110001", nationality: "Indian" });
  assert.match(s.notes ?? "", /Late arrival\nBooked on Booking.com through Channex/);
});

test("two rooms share one group; a room not matched to our types is kept aside with all its details", () => {
  const two = mapRevision(
    {
      ...revision,
      payment_collect: "property",
      ota_name: "Goibibo",
      secondary_ota: "MakeMyTrip",
      rooms: [
        { ...revision.rooms![0], days: null, amount: "5000" },
        { ...revision.rooms![0], room_type_id: null, rate_plan_id: null, occupancy: { adults: 1 } },
      ],
    },
    map
  );
  assert.equal(two.source, "makemytrip");
  assert.equal(two.stays.length, 1);
  assert.equal(two.stays[0].ratePerNight, 2500); // amount / nights
  assert.equal(two.stays[0].prepaid, undefined);
  assert.equal(two.stays[0].groupId, channexGroupId("bk1"));
  assert.deepEqual(two.refs, ["channex:bk1:0", "channex:bk1:1"]);
  assert.equal(two.unmapped[0].ref, "channex:bk1:1");
  assert.match(two.unmapped[0].details, /Rahul Sharma; phone \+91 90000 00000.*2026-11-20, leaving 2026-11-22 \(2 nights\).*MakeMyTrip booking number 4455.*NOT in your bookings/);
});

test("a price in another currency is not used as ours, and the guest's country gives the nationality", () => {
  const s = mapRevision({ ...revision, currency: "EUR", customer: { name: "Anna", surname: "", country: "NL" } }, map).stays[0];
  assert.equal(s.ratePerNight, null);
  assert.equal(s.prepaid, undefined);
  assert.equal(s.guest.nationality, "Dutch");
  assert.equal(nationalityFromCountry("XX"), null);
  assert.equal(nationalityFromCountry(""), null);
});

test("the webhook secret is different for every property and compared safely", () => {
  const a = webhookSecret("prop-a", "s3cret");
  assert.notEqual(a, webhookSecret("prop-b", "s3cret"));
  assert.ok(sameSecret(a, a));
  assert.ok(!sameSecret(a.slice(1), a));
  assert.ok(!sameSecret(null, a));
});
