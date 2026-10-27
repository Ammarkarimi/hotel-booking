import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappLink } from "../client";

const number = (phone: string) => whatsappLink(phone, "Hi").split("?")[0].replace("https://wa.me/", "");

test("WhatsApp links use the full international number", () => {
  assert.equal(number("98765 43210"), "919876543210");
  assert.equal(number("+91 98765 43210"), "919876543210");
  assert.equal(number("09876543210"), "919876543210");
  assert.equal(number("+91 098765 43210"), "919876543210");
  assert.equal(number("0091 98765 43210"), "919876543210");
  assert.equal(number("+1 555 0123"), "15550123");
  assert.equal(number("+33 6 12 34 56 78"), "33612345678");
});
