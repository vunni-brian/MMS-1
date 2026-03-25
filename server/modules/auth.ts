import {
  createId,
  get,
  getManagerForMarket,
  getUserRecordById,
  getUserRecordByPhone,
  queueNotification,
  run,
  serializeAuthUser,
  transaction,
} from "../lib/db.ts";
import { HttpError, readJsonBody, sendEmpty, sendJson, type RouteDefinition } from "../lib/http.ts";
import { createSessionForUser, destroySession, requireAuth } from "../lib/session.ts";
import { addMinutes, createOtpCode, hashOtpCode, hashPassword, nowIso, verifyOtpCode, verifyPassword } from "../lib/security.ts";
import { persistFilePayload, validateFilePayload } from "../lib/storage.ts";
import type { FilePayload } from "../types.ts";

const loadOtpChallenge = (challengeId: string) => {
  return get<{
    id: string;
    user_id: string | null;
    purpose: string;
    phone: string;
    code_hash: string;
    expires_at: string;
    verified_at: string | null;
  }>(`SELECT id, user_id, purpose, phone, code_hash, expires_at, verified_at FROM otp_challenges WHERE id = ?`, [challengeId]);
};

const validateOtpChallenge = ({
  challengeId,
  code,
  purpose,
}: {
  challengeId: string;
  code: string;
  purpose: string;
}) => {
  const challenge = loadOtpChallenge(challengeId);
  if (!challenge || challenge.purpose !== purpose) {
    throw new HttpError(404, "OTP challenge not found.");
  }
  if (challenge.verified_at) {
    throw new HttpError(409, "OTP challenge has already been used.");
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw new HttpError(410, "OTP challenge has expired.");
  }
  if (!verifyOtpCode(code, challenge.code_hash)) {
    throw new HttpError(400, "Invalid OTP code.");
  }
  return challenge;
};

export const authRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/auth/register-vendor",
    handler: async ({ req, res, config }) => {
      const body = await readJsonBody<{
        name: string;
        email: string;
        phone: string;
        password: string;
        marketId: string;
        idDocument: FilePayload | null;
      }>(req);

      if (!body.name || !body.email || !body.phone || !body.password || !body.marketId) {
        throw new HttpError(400, "Name, email, phone, password, and market are required.");
      }

      validateFilePayload(body.idDocument, ["application/pdf", "image/jpeg", "image/png"], true);

      const market = get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [body.marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const existingPhone = get<{ id: string }>(`SELECT id FROM users WHERE phone = ?`, [body.phone]);
      const existingEmail = get<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [body.email]);
      if (existingPhone || existingEmail) {
        throw new HttpError(409, "A user with that phone or email already exists.");
      }

      const userId = createId("user");
      const file = persistFilePayload("vendor-documents", userId, body.idDocument!);
      const challengeId = createId("otp");
      const otpCode = createOtpCode();
      const timestamp = nowIso();
      const expiresAt = addMinutes(config.otpTtlMinutes);

      transaction(() => {
        run(
          `INSERT INTO users (id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'vendor', ?, 0, NULL, ?, ?)`,
          [
            userId,
            body.name.trim(),
            body.email.trim().toLowerCase(),
            body.phone.trim(),
            hashPassword(body.password),
            market.id,
            timestamp,
            timestamp,
          ],
        );
        run(
          `INSERT INTO vendor_profiles (user_id, approval_status, approval_reason, id_document_name, id_document_path, id_document_mime_type, id_document_size, approved_by, approved_at, rejected_by, rejected_at)
           VALUES (?, 'pending', NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
          [userId, file.name, file.storagePath, file.mimeType, file.size],
        );
        run(
          `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
           VALUES (?, ?, 'registration', ?, ?, ?, NULL, NULL, ?)`,
          [challengeId, userId, body.phone.trim(), hashOtpCode(otpCode), expiresAt, timestamp],
        );
      });
      queueNotification({
        userId,
        type: "otp",
        message: `Your verification code is ${otpCode}. It expires in ${config.otpTtlMinutes} minutes.`,
        channels: ["system", "sms"],
        destinationPhone: body.phone.trim(),
      });
      const marketManager = getManagerForMarket(market.id);
      if (marketManager) {
        queueNotification({
          userId: marketManager.id,
          type: "system",
          message: `New vendor registration for ${market.name}: ${body.name.trim()} is awaiting approval.`,
          channels: ["system", "sms"],
          destinationPhone: marketManager.phone,
        });
      }

      sendJson(res, 201, {
        challengeId,
        expiresAt,
        developmentCode: config.devMode ? otpCode : undefined,
        status: "otp_sent",
      });
    },
  },
  {
    method: "POST",
    path: "/auth/verify-registration-otp",
    handler: async ({ req, res }) => {
      const body = await readJsonBody<{ challengeId: string; code: string }>(req);
      const challenge = validateOtpChallenge({
        challengeId: body.challengeId,
        code: body.code,
        purpose: "registration",
      });

      const timestamp = nowIso();
      run(`UPDATE otp_challenges SET verified_at = ? WHERE id = ?`, [timestamp, challenge.id]);
      run(`UPDATE users SET phone_verified_at = ?, updated_at = ? WHERE id = ?`, [timestamp, timestamp, challenge.user_id]);

      sendJson(res, 200, {
        status: "pending_approval",
        message: "Phone verified. Your vendor profile is pending manager approval.",
      });
    },
  },
  {
    method: "POST",
    path: "/auth/login",
    handler: async ({ req, res, config }) => {
      const body = await readJsonBody<{ phone: string; password: string }>(req);
      const user = getUserRecordByPhone(body.phone?.trim() || "");
      if (!user || !verifyPassword(body.password || "", user.password_hash)) {
        throw new HttpError(401, "Invalid phone number or password.");
      }

      if (user.role === "vendor") {
        if (!user.phone_verified_at) {
          throw new HttpError(403, "Please verify your phone number before signing in.");
        }
        if (user.vendor_status === "pending") {
          throw new HttpError(403, "Your vendor profile is awaiting manager approval.");
        }
        if (user.vendor_status === "rejected") {
          throw new HttpError(403, "Your vendor profile was rejected. Contact a manager.");
        }
      }

      if (user.role === "manager" && user.mfa_enabled) {
        const otpCode = createOtpCode();
        const challengeId = createId("otp");
        const timestamp = nowIso();
        run(
          `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
           VALUES (?, ?, 'manager_mfa', ?, ?, ?, NULL, NULL, ?)`,
          [challengeId, user.id, user.phone, hashOtpCode(otpCode), addMinutes(config.otpTtlMinutes), timestamp],
        );
        queueNotification({
          userId: user.id,
          type: "otp",
          message: `Your manager MFA code is ${otpCode}. It expires in ${config.otpTtlMinutes} minutes.`,
          channels: ["system", "sms"],
          destinationPhone: user.phone,
        });

        sendJson(res, 200, {
          mfaRequired: true,
          challengeId,
          expiresAt: addMinutes(config.otpTtlMinutes),
          developmentCode: config.devMode ? otpCode : undefined,
        });
        return;
      }

      const token = createSessionForUser(user.id);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/verify-manager-mfa",
    handler: async ({ req, res }) => {
      const body = await readJsonBody<{ challengeId: string; code: string }>(req);
      const challenge = validateOtpChallenge({
        challengeId: body.challengeId,
        code: body.code,
        purpose: "manager_mfa",
      });

      const timestamp = nowIso();
      run(`UPDATE otp_challenges SET verified_at = ? WHERE id = ?`, [timestamp, challenge.id]);

      const user = getUserRecordById(challenge.user_id!);
      if (!user) {
        throw new HttpError(404, "User not found for MFA challenge.");
      }

      const token = createSessionForUser(user.id);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/logout",
    handler: ({ res, auth }) => {
      const session = requireAuth(auth);
      destroySession(session.token);
      sendEmpty(res);
    },
  },
  {
    method: "GET",
    path: "/auth/me",
    handler: ({ res, auth }) => {
      const session = requireAuth(auth);
      sendJson(res, 200, { user: session.user });
    },
  },
];
