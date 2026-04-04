import crypto from "node:crypto";

const hashSecret = (secret: string, salt: string) => {
  return crypto.pbkdf2Sync(secret, salt, 100_000, 64, "sha512").toString("hex");
};

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${hashSecret(password, salt)}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashSecret(password, salt)));
};

export const createToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const createOtpCode = () => String(crypto.randomInt(100_000, 1_000_000));
export const hashOtpCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
export const verifyOtpCode = (code: string, storedHash: string) => hashOtpCode(code) === storedHash;
export const createTemporaryPassword = () => `Mgr${crypto.randomBytes(4).toString("hex")}!`;
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

export const nowIso = () => new Date().toISOString();
export const addMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
export const addHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
export const isExpired = (isoString: string | null) => !isoString || new Date(isoString).getTime() <= Date.now();
