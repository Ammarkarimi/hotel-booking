import { test } from "node:test";
import assert from "node:assert/strict";
import { deflate } from "pako";
import { checkAadhaarQr, namesMatch, qrNumberToBytes } from "../aadhaar-qr";

// A made-up card in the Secure QR "V2" layout, signed with a key made for this test.
async function makeQr(fields: string[], photo: number[]) {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const text = fields.map((f) => [...new TextEncoder().encode(f), 255]).flat();
  const body = Uint8Array.from([...text, ...photo]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, body));
  const packed = deflate(Uint8Array.from([...body, ...signature]));
  let n = BigInt(0);
  for (const b of packed) n = (n << BigInt(8)) | BigInt(b);
  const spki = Buffer.from(await crypto.subtle.exportKey("spki", keys.publicKey)).toString("base64");
  return { qr: n.toString(), key: { name: "test", spki } };
}

const FIELDS = ["V2", "3", "901220250101123456789", "Asha Rao", "12-04-1990", "F", "W/O Ravi Rao", "Ahmedabad", "", "12", "MG Road", "380009", "Navrangpura", "Gujarat", "", "Ahmedabad City", "Ahmedabad", "4321"];
const PHOTO = [0xff, 0x4f, 0xff, 0x51, 1, 2, 3, 0xff, 0xd9, ...Array(64).fill(7)]; // photo, then email and mobile hashes

test("a QR signed by a known key is genuine, and its details are read", async () => {
  const { qr, key } = await makeQr(FIELDS, PHOTO);
  assert.deepEqual(qrNumberToBytes("65535"), Uint8Array.from([255, 255]));
  const r = await checkAadhaarQr(qr, [key]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.key, "test");
  assert.equal(r.card.version, "V2");
  assert.equal(r.card.name, "Asha Rao");
  assert.equal(r.card.dob, "12-04-1990");
  assert.equal(r.card.gender, "Female");
  assert.equal(r.card.state, "Gujarat");
  assert.equal(r.card.pinCode, "380009");
  assert.deepEqual([...(r.card.photo ?? [])], PHOTO.slice(0, 9));
});

test("a changed QR, an unknown key, other QR codes and old unsigned QR codes are refused", async () => {
  const { qr, key } = await makeQr(FIELDS, PHOTO);
  const other = await makeQr(FIELDS, PHOTO);
  assert.deepEqual(await checkAadhaarQr(other.qr, [key]).then((r) => [r.ok, !r.ok && r.reason]), [false, "unsigned"]);
  // Someone edits the name: the signature no longer matches.
  const edited = await makeQr(FIELDS.map((f) => (f === "Asha Rao" ? "Asha Roy" : f)), PHOTO);
  assert.equal((await checkAadhaarQr(edited.qr, [key])).ok, false);
  assert.equal((await checkAadhaarQr(qr.slice(0, -3) + "000", [key])).ok, false);
  assert.deepEqual(await checkAadhaarQr("https://example.com/menu", [key]), { ok: false, reason: "not_aadhaar" });
  assert.deepEqual(await checkAadhaarQr('<?xml version="1.0"?><PrintLetterBarcodeData uid="xxxx"/>', [key]), { ok: false, reason: "old_qr" });
  // The first Secure QR layout has no version field and no mobile digits.
  const v1 = await makeQr(FIELDS.slice(1, 17), PHOTO);
  const r = await checkAadhaarQr(v1.qr, [v1.key]);
  assert.equal(r.ok && r.card.version === null && r.card.name === "Asha Rao", true);
});

test("the name on the card is compared with the booking", () => {
  assert.equal(namesMatch("Asha Ravi Rao", "Asha Rao"), true);
  assert.equal(namesMatch("ASHA RAO", "asha"), true);
  assert.equal(namesMatch("Mohammed Imran Ali", "Mohd Imran Ali"), false);
  assert.equal(namesMatch("Asha Rao", "Neha Gupta"), false);
});
