// Keeps secrets the owner types into Settings (the Razorpay key secret) encrypted in the database.
// AES-256-GCM with a key made from SETTINGS_SECRET, or JWT_SECRET when that is not set. If the
// key changes, old secrets can no longer be read and the owner types them in again.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.SETTINGS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("SETTINGS_SECRET or JWT_SECRET must be set");
    return createHash("sha256").update("innvela-dev-settings-secret").digest();
  }
  return createHash("sha256").update(`innvela-settings:${secret}`).digest();
}

/** "v1.<iv>.<tag>.<data>", all base64url. */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The secret, or null when it is missing or cannot be read (for example the key changed). */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
