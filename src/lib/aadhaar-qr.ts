// Reading the Secure QR code printed on an Aadhaar and checking UIDAI's digital signature on it.
// Runs on the front-desk phone: the details are shown to staff to compare with the guest and are
// never sent to the server or saved. Only "verified by <staff> at <time>" is saved.
//
// Format (UIDAI Secure QR): the QR holds one big decimal number. As bytes it is zlib-compressed
// data: text fields separated by byte 255, then the photo (JPEG 2000), then a 256-byte
// RSA-SHA256 signature over everything before it.
import { inflate } from "pako";
import { UIDAI_KEYS, type UidaiKey } from "./aadhaar-keys";

export interface AadhaarCard {
  /** "V2" etc. on newer QR codes; null on the first Secure QR format. */
  version: string | null;
  name: string;
  /** DD-MM-YYYY, or only the year on some cards. */
  dob: string;
  gender: string;
  careOf: string;
  district: string;
  state: string;
  pinCode: string;
  /** The photo as JPEG 2000 bytes (browsers cannot show it directly). */
  photo: Uint8Array | null;
}

export type QrCheck =
  | { ok: true; card: AadhaarCard; key: string }
  /** not_aadhaar: some other QR. old_qr: an early Aadhaar QR without a signature. unsigned: not signed by a known UIDAI key. */
  | { ok: false; reason: "not_aadhaar" | "old_qr" | "unsigned"; card?: AadhaarCard };

const DELIMITER = 255;
const SIGNATURE_BYTES = 256;

/** The decimal number in the QR as bytes. */
export function qrNumberToBytes(text: string): Uint8Array {
  let n = BigInt(text.trim());
  const out: number[] = [];
  while (n > BigInt(0)) {
    out.push(Number(n & BigInt(255)));
    n >>= BigInt(8);
  }
  return Uint8Array.from(out.reverse());
}

function splitFields(data: Uint8Array, count: number) {
  const fields: string[] = [];
  const decoder = new TextDecoder("iso-8859-1");
  let start = 0;
  for (let i = 0; i < count; i++) {
    const end = data.indexOf(DELIMITER, start);
    if (end < 0) return null;
    fields.push(decoder.decode(data.subarray(start, end)));
    start = end + 1;
  }
  return { fields, rest: start };
}

/** Reads the fields and photo. Returns null if the bytes are not an Aadhaar Secure QR. */
export function parseSecureQr(data: Uint8Array): AadhaarCard | null {
  if (data.length <= SIGNATURE_BYTES + 20) return null;
  // Newer codes start with a version field such as "V2"; the first format starts with the email/mobile indicator.
  const versioned = data[0] === 0x56 /* V */ && data.indexOf(DELIMITER) <= 4;
  const count = versioned ? 18 : 16;
  const split = splitFields(data, count);
  if (!split) return null;
  const f = versioned ? split.fields.slice(1) : split.fields;
  if (!/^[0-3]$/.test(f[0])) return null;
  const utf8 = (s: string) => new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  const [, , name, dob, gender, careOf, district, , , , pinCode, , state] = f.map(utf8);
  if (!name) return null;

  // The photo runs from after the text to its JPEG 2000 end marker (FF D9), before any hashes and the signature.
  const photoArea = data.subarray(split.rest, data.length - SIGNATURE_BYTES);
  let end = -1;
  for (let i = photoArea.length - 2; i >= 0; i--) {
    if (photoArea[i] === 0xff && photoArea[i + 1] === 0xd9) {
      end = i + 2;
      break;
    }
  }
  return {
    version: versioned ? split.fields[0] : null,
    name,
    dob,
    gender: gender === "M" ? "Male" : gender === "F" ? "Female" : gender === "T" ? "Transgender" : gender,
    careOf,
    district,
    state,
    pinCode,
    photo: end > 0 ? photoArea.slice(0, end) : null,
  };
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Reads a scanned QR and checks it was signed by UIDAI. Never throws for a bad QR. */
export async function checkAadhaarQr(text: string, keys: Pick<UidaiKey, "name" | "spki">[] = UIDAI_KEYS): Promise<QrCheck> {
  const raw = text.trim();
  // Aadhaar letters before 2018 had a plain XML QR with no signature.
  if (/^(<\?xml|<PrintLetterBarcodeData|<QPDB)/i.test(raw)) return { ok: false, reason: "old_qr" };
  if (!/^\d{200,}$/.test(raw)) return { ok: false, reason: "not_aadhaar" };

  let data: Uint8Array;
  try {
    data = inflate(qrNumberToBytes(raw));
  } catch {
    return { ok: false, reason: "not_aadhaar" };
  }
  const card = parseSecureQr(data);
  if (!card) return { ok: false, reason: "not_aadhaar" };

  const signed = data.slice(0, data.length - SIGNATURE_BYTES);
  const signature = data.slice(data.length - SIGNATURE_BYTES);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, reason: "unsigned", card };
  for (const key of keys) {
    try {
      const publicKey = await subtle.importKey("spki", base64ToBytes(key.spki), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      if (await subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signed)) return { ok: true, card, key: key.name };
    } catch {
      // A key that cannot be used is skipped.
    }
  }
  return { ok: false, reason: "unsigned", card };
}

/** Whether the name on the card and the name in the booking look like the same person. */
export function namesMatch(cardName: string, bookingName: string) {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const card = words(cardName);
  const booking = words(bookingName);
  if (!card.length || !booking.length) return false;
  // Every word typed for the booking (e.g. first and last name) appears on the card.
  return booking.every((w) => card.some((c) => c === w || (w.length >= 4 && (c.startsWith(w) || w.startsWith(c)))));
}
