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
import { createSupabaseAuthUser, deleteSupabaseAuthUser, findSupabaseAuthUser, verifySupabaseCredentials } from "../lib/supabase.ts";
import { persistFilePayload, removeStoredFile, validateFilePayload } from "../lib/storage.ts";
import type { FilePayload } from "../types.ts";

const loadOtpChallenge = async (challengeId: string) => {
  return await get<{
    id: string;
    user_id: string | null;
    purpose: string;
    phone: string;
    code_hash: string;
    expires_at: string;
    verified_at: string | null;
  }>(`SELECT id, user_id, purpose, phone, code_hash, expires_at, verified_at FROM otp_challenges WHERE id = ?`, [challengeId]);
};

const validateOtpChallenge = async ({
  challengeId,
  code,
  purpose,
}: {
  challengeId: string;
  code: string;
  purpose: string;
}) => {
  const challenge = await loadOtpChallenge(challengeId);
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

const requiresPrivilegedMfa = (user: {
  role: "vendor" | "manager" | "official";
  mfa_enabled: number;
}) => user.role === "official" || (user.role === "manager" && Boolean(user.mfa_enabled));

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

      const market = await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [body.marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const existingPhone = await get<{ id: string }>(`SELECT id FROM users WHERE phone = ?`, [body.phone]);
      const existingEmail = await get<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [body.email]);
      if (existingPhone || existingEmail) {
        throw new HttpError(409, "A user with that phone or email already exists.");
      }

      const userId = createId("user");
      const challengeId = createId("otp");
      const otpCode = createOtpCode();
      const timestamp = nowIso();
      const expiresAt = addMinutes(config.otpTtlMinutes);
      let authUserId: string | null = null;
      let storedDocumentPath: string | null = null;

      try {
        if (config.supabaseAuthEnabled) {
          const existingSupabaseUser = await findSupabaseAuthUser({
            phone: body.phone.trim(),
            email: body.email.trim().toLowerCase(),
          });
          if (existingSupabaseUser) {
            throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
          }

          const authUser = await createSupabaseAuthUser({
            email: body.email.trim().toLowerCase(),
            phone: body.phone.trim(),
            password: body.password,
            localUserId: userId,
            name: body.name.trim(),
            role: "vendor",
            marketId: market.id,
          });
          authUserId = authUser?.id || null;
        }

        const file = await persistFilePayload("vendor-documents", userId, body.idDocument!);
        storedDocumentPath = file.storagePath;

        await transaction(async () => {
          await run(
            `INSERT INTO users (id, auth_user_id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'vendor', ?, 0, NULL, ?, ?)`,
            [
              userId,
              authUserId,
              body.name.trim(),
              body.email.trim().toLowerCase(),
              body.phone.trim(),
              authUserId ? hashPassword(createId("supabase_shadow")) : hashPassword(body.password),
              market.id,
              timestamp,
              timestamp,
            ],
          );
          await run(
            `INSERT INTO vendor_profiles (user_id, approval_status, approval_reason, id_document_name, id_document_path, id_document_mime_type, id_document_size, approved_by, approved_at, rejected_by, rejected_at)
             VALUES (?, 'pending', NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
            [userId, file.name, file.storagePath, file.mimeType, file.size],
          );
          await run(
            `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
             VALUES (?, ?, 'registration', ?, ?, ?, NULL, NULL, ?)`,
            [challengeId, userId, body.phone.trim(), hashOtpCode(otpCode), expiresAt, timestamp],
          );
        });
      } catch (error) {
        await removeStoredFile(storedDocumentPath);
        if (authUserId) {
          await deleteSupabaseAuthUser(authUserId);
        }
        throw error;
      }
      await queueNotification({
        userId,
        type: "otp",
        message: `Your verification code is ${otpCode}. It expires in ${config.otpTtlMinutes} minutes.`,
        channels: ["system", "sms"],
        destinationPhone: body.phone.trim(),
      });
      const marketManager = await getManagerForMarket(market.id);
      if (marketManager) {
        await queueNotification({
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
      const challenge = await validateOtpChallenge({
        challengeId: body.challengeId,
        code: body.code,
        purpose: "registration",
      });

      const timestamp = nowIso();
      await run(`UPDATE otp_challenges SET verified_at = ? WHERE id = ?`, [timestamp, challenge.id]);
      await run(`UPDATE users SET phone_verified_at = ?, updated_at = ? WHERE id = ?`, [timestamp, timestamp, challenge.user_id]);

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
      const user = await getUserRecordByPhone(body.phone?.trim() || "");
      if (!user) {
        throw new HttpError(401, "Invalid phone number or password.");
      }

      const isPasswordValid =
        config.supabaseAuthEnabled && user.auth_user_id
          ? (await verifySupabaseCredentials({
              phone: user.phone,
              password: body.password || "",
            }))?.id === user.auth_user_id
          : verifyPassword(body.password || "", user.password_hash);

      if (!isPasswordValid) {
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

      if (requiresPrivilegedMfa(user)) {
        const otpCode = createOtpCode();
        const challengeId = createId("otp");
        const timestamp = nowIso();
        await run(
          `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
           VALUES (?, ?, 'manager_mfa', ?, ?, ?, NULL, NULL, ?)`,
          [challengeId, user.id, user.phone, hashOtpCode(otpCode), addMinutes(config.otpTtlMinutes), timestamp],
        );
        await queueNotification({
          userId: user.id,
          type: "otp",
          message: `Your secure login code is ${otpCode}. It expires in ${config.otpTtlMinutes} minutes.`,
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

      const token = await createSessionForUser(user.id);
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
      const challenge = await validateOtpChallenge({
        challengeId: body.challengeId,
        code: body.code,
        purpose: "manager_mfa",
      });

      const timestamp = nowIso();
      await run(`UPDATE otp_challenges SET verified_at = ? WHERE id = ?`, [timestamp, challenge.id]);

      const user = await getUserRecordById(challenge.user_id!);
      if (!user) {
        throw new HttpError(404, "User not found for MFA challenge.");
      }

      const token = await createSessionForUser(user.id);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/verify-privileged-mfa",
    handler: async ({ req, res }) => {
      const body = await readJsonBody<{ challengeId: string; code: string }>(req);
      const challenge = await validateOtpChallenge({
        challengeId: body.challengeId,
        code: body.code,
        purpose: "manager_mfa",
      });

      const timestamp = nowIso();
      await run(`UPDATE otp_challenges SET verified_at = ? WHERE id = ?`, [timestamp, challenge.id]);

      const user = await getUserRecordById(challenge.user_id!);
      if (!user) {
        throw new HttpError(404, "User not found for MFA challenge.");
      }

      const token = await createSessionForUser(user.id);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/logout",
    handler: async ({ res, auth }) => {
      const session = requireAuth(auth);
      await destroySession(session.token);
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
