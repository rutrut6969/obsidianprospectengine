import crypto from "crypto";

function getKey(): Buffer | null {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!raw) return null;

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  return decoded.length === 32 ? decoded : null;
}

export function encryptSensitiveValue(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = getKey();
  if (!key) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function last4(value: string | null | undefined): string | null {
  const clean = value?.replace(/\D/g, "") ?? "";
  return clean ? clean.slice(-4).padStart(Math.min(4, clean.length), "X") : null;
}

export function maskEnding(value: string | null | undefined): string | null {
  if (!value) return null;
  return `ending in ${value}`;
}
