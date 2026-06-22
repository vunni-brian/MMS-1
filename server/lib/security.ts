/**
 * @file Security / cryptography utilities.
 * Password hashing & verification (PBKDF2), token & OTP code generation,
 * phone-number normalisation, email/phone validation, and date helpers.
 */

import crypto from "node:crypto";

const hashSecret = (secret: string, salt: string) => {
  return crypto.pbkdf2Sync(secret, salt, 100_000, 64, "sha512").toString("hex");
};

/** Hash a password with a random salt using PBKDF2 (format: `salt:hash`). */
export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${hashSecret(password, salt)}`;
};

/** Verify a password against a stored `salt:hash` string (constant-time comparison). */
export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashSecret(password, salt)));
};

/** Generate a cryptographically random base64url token (256-bit). */
export const createToken = () => crypto.randomBytes(32).toString("base64url");
/** SHA-256 hash of a token (for storage / lookup). */
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Generate a 6-digit OTP code. */
export const createOtpCode = () => String(crypto.randomInt(100_000, 1_000_000));
/** SHA-256 hash of an OTP code (for storage). */
export const hashOtpCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
/** Verify an OTP code against its stored hash (constant-time comparison). */
export const verifyOtpCode = (code: string, storedHash: string) => {
  const computedHash = hashOtpCode(code);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
};
/** Generate a temporary password string (8 chars + `!`). */
export const createTemporaryPassword = () => `Tmp${crypto.randomBytes(4).toString("hex")}!`;

/** Normalise a phone number to E.164 format (`+256…`), handling common UG formats. */
export const normalizePhoneNumber = (phone: string) => {
  const compact = phone.trim().replace(/\s+/g, "");
  const digitsOnly = compact.replace(/[^\d]/g, "");

  if (!digitsOnly) {
    return compact;
  }

  if (compact.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith("256") && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith("0") && digitsOnly.length === 10) {
    return `+256${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith("7") && digitsOnly.length === 9) {
    return `+256${digitsOnly}`;
  }

  return compact;
};

/** Basic email format validation. */
export const isValidEmailAddress = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
/** Basic phone-number validation (E.164: `+` followed by 8-15 digits). */
export const isValidPhoneNumber = (phone: string) => /^\+\d{8,15}$/.test(phone.trim());

/** Return the current UTC timestamp as an ISO 8601 string. */
export const nowIso = () => new Date().toISOString();
/** Return an ISO string `minutes` from now. */
export const addMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
/** Return an ISO string `hours` from now. */
export const addHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
/** Check whether an ISO string is in the past (or null). */
export const isExpired = (isoString: string | null) => !isoString || new Date(isoString).getTime() <= Date.now();
