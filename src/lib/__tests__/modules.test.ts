import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_MODULES, STARTER_PACKAGES, applyModules, cleanModules, moduleForPath, resolveModules } from "../modules";

test("unknown or repeated modules are dropped and the order is fixed", () => {
  assert.deepEqual(cleanModules(["website", "nonsense", "pathik", "website", 3]), ["pathik", "website"]);
  assert.deepEqual(cleanModules(null), []);
});

test("a hotel on a package gets the package's modules, otherwise its own list", () => {
  assert.deepEqual(resolveModules({ modules: [...ALL_MODULES], package: { modules: ["pathik"] } }), ["pathik"]);
  assert.deepEqual(resolveModules({ modules: ["reports", "expenses"], package: null }), ["expenses", "reports"]);
  assert.deepEqual(resolveModules({ modules: [], package: { modules: [] } }), []);
});

test("screens belong to their module", () => {
  assert.equal(moduleForPath("/reports"), "reports");
  assert.equal(moduleForPath("/guest-forms/abc"), "guest_forms");
  assert.equal(moduleForPath("/shifts"), "shifts");
  assert.equal(moduleForPath("/"), null);
  assert.equal(moduleForPath("/bookings"), null);
  assert.equal(moduleForPath("/reportsx"), null);
});

test("a feature outside the package reads as off, but the owner's choice is not overwritten", () => {
  const saved = { pathik: true, staffShifts: true, rateTips: true, websiteEnabled: true, hotelName: "Sea View" };
  const basic = applyModules(saved, ["pathik"]);
  assert.deepEqual(basic, { pathik: true, staffShifts: false, rateTips: false, websiteEnabled: false, hotelName: "Sea View" });
  assert.equal(saved.staffShifts, true);
  // The package never switches on what the owner switched off.
  assert.equal(applyModules({ ...saved, websiteEnabled: false }, ALL_MODULES).websiteEnabled, false);
});

test("the starter packages grow from Basic to Premium", () => {
  const [basic, standard, premium] = STARTER_PACKAGES.map((p) => p.modules);
  assert.ok(basic.every((m) => standard.includes(m)));
  assert.ok(standard.every((m) => premium.includes(m)));
  assert.deepEqual(premium, ALL_MODULES);
});
