import {
  createId,
  get,
  getManagerForMarket,
  getUserRecordById,
  getUserRecordByPhone,
  logAuditEvent,
  queueNotification,
  run,
  serializeAuthUser,
  transaction,
} from "../lib/db.ts";
import { HttpError, readJsonBody, sendEmpty, sendJson, type RouteDefinition } from "../lib/http.ts";
import { getOtpNotificationMessage } from "../lib/otp-messages.ts";
import { applyUserPassword, revokeUserSessions } from "../lib/passwords.ts";
import { createSessionForUser, destroySession, requireAuth } from "../lib/session.ts";
import { addMinutes, createOtpCode, createTemporaryPassword, hashOtpCode, hashPassword, hashToken, normalizePhoneNumber, nowIso, verifyOtpCode, verifyPassword } from "../lib/security.ts";
import { createSupabaseAuthUser, deleteSupabaseAuthUser, findSupabaseAuthUser, updateSupabaseAuthUser, verifySupabaseCredentials } from "../lib/supabase.ts";
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
  role: "vendor" | "manager" | "official" | "admin";
  mfa_enabled: number;
}) => user.role === "official" || user.role === "admin" || (user.role === "manager" && Boolean(user.mfa_enabled));

const logLoginSuccess = async (
  user: {
    id: string;
    name: string;
    phone: string;
    role: "vendor" | "manager" | "official" | "admin";
    market_id: string | null;
  },
  mfa: boolean,
) => {
  await logAuditEvent({
    actorUserId: user.id,
    actorName: user.name,
    actorRole: user.role,
    marketId: user.market_id,
    action: "LOGIN_SUCCESS",
    entityType: "user",
    entityId: user.id,
    details: {
      phone: user.phone,
      method: mfa ? "password_otp" : "password",
      mfa,
    },
  });
};

const issueRegistrationChallenge = async ({
  userId,
  phone,
  config,
}: {
  userId: string;
  phone: string;
  config: {
    appName: string;
    otpTtlMinutes: number;
    otpRegistrationMessageTemplate: string | null;
    otpLoginMessageTemplate: string | null;
  };
}) => {
  const challengeId = createId("otp");
  const otpCode = createOtpCode();
  const expiresAt = addMinutes(config.otpTtlMinutes);
  const timestamp = nowIso();

  await run(
    `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
     VALUES (?, ?, 'registration', ?, ?, ?, NULL, NULL, ?)`,
    [challengeId, userId, phone, hashOtpCode(otpCode), expiresAt, timestamp],
  );

  await queueNotification({
    userId,
    type: "otp",
    message: getOtpNotificationMessage({
      config,
      code: otpCode,
      purpose: "registration",
    }),
    channels: ["system", "sms"],
    destinationPhone: phone,
  });

  return {
    challengeId,
    expiresAt,
    otpCode,
  };
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
        nationalIdNumber: string;
        district: string;
        idDocument: FilePayload | null;
        lcLetter: FilePayload | null;
      }>(req);

      const name = body.name?.trim();
      const nationalIdNumber = body.nationalIdNumber?.trim().toUpperCase();
      const district = body.district?.trim();

      if (!name || !body.email || !body.phone || !body.password || !body.marketId || !nationalIdNumber || !district) {
        throw new HttpError(400, "Name, email, phone, password, market, NIN, and district are required.");
      }

      validateFilePayload(body.idDocument, ["application/pdf", "image/jpeg", "image/png"], true);
      validateFilePayload(body.lcLetter, ["application/pdf", "image/jpeg", "image/png"], true);

      const market = await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [body.marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const normalizedPhone = normalizePhoneNumber(body.phone);

      const existingPhone = await get<{ id: string }>(`SELECT id FROM users WHERE phone = ?`, [normalizedPhone]);
      const existingEmail = await get<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [body.email]);
      if (existingPhone || existingEmail) {
        throw new HttpError(409, "A user with that phone or email already exists.");
      }
      const existingNationalId = await get<{ user_id: string }>(
        `SELECT user_id FROM vendor_profiles WHERE national_id_number = ? LIMIT 1`,
        [nationalIdNumber],
      );
      if (existingNationalId) {
        throw new HttpError(409, "A vendor with that NIN already exists.");
      }

      const userId = createId("user");
      const challengeId = createId("otp");
      const otpCode = createOtpCode();
      const timestamp = nowIso();
      const expiresAt = addMinutes(config.otpTtlMinutes);
      let authUserId: string | null = null;
      let storedDocumentPath: string | null = null;
      let storedLcLetterPath: string | null = null;

      try {
        if (config.supabaseAuthEnabled) {
          const existingSupabaseUser = await findSupabaseAuthUser({
            phone: normalizedPhone,
            email: body.email.trim().toLowerCase(),
          });
          if (existingSupabaseUser) {
            throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
          }

          const authUser = await createSupabaseAuthUser({
            email: body.email.trim().toLowerCase(),
            phone: normalizedPhone,
            password: body.password,
            localUserId: userId,
            name,
            role: "vendor",
            marketId: market.id,
          });
          authUserId = authUser?.id || null;
        }

        const file = await persistFilePayload("vendor-documents", userId, body.idDocument!);
        storedDocumentPath = file.storagePath;
        const lcLetter = await persistFilePayload("vendor-documents", userId, body.lcLetter!);
        storedLcLetterPath = lcLetter.storagePath;

        await transaction(async () => {
          await run(
            `INSERT INTO users (id, auth_user_id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'vendor', ?, 0, NULL, ?, ?)`,
            [
              userId,
              authUserId,
              name,
              body.email.trim().toLowerCase(),
              normalizedPhone,
              hashPassword(body.password),
              market.id,
              timestamp,
              timestamp,
            ],
          );
          await run(
            `INSERT INTO vendor_profiles (
               user_id,
               approval_status,
               approval_reason,
               national_id_number,
               district,
               id_document_name,
               id_document_path,
               id_document_mime_type,
               id_document_size,
               lc_letter_name,
               lc_letter_path,
               lc_letter_mime_type,
               lc_letter_size,
               approved_by,
               approved_at,
               rejected_by,
               rejected_at
             )
             VALUES (?, 'pending', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
            [
              userId,
              nationalIdNumber,
              district,
              file.name,
              file.storagePath,
              file.mimeType,
              file.size,
              lcLetter.name,
              lcLetter.storagePath,
              lcLetter.mimeType,
              lcLetter.size,
            ],
          );
          await run(
            `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
             VALUES (?, ?, 'registration', ?, ?, ?, NULL, NULL, ?)`,
            [challengeId, userId, normalizedPhone, hashOtpCode(otpCode), expiresAt, timestamp],
          );
        });
      } catch (error) {
        await removeStoredFile(storedDocumentPath);
        await removeStoredFile(storedLcLetterPath);
        if (authUserId) {
          await deleteSupabaseAuthUser(authUserId);
        }
        throw error;
      }
      await queueNotification({
        userId,
        type: "otp",
        message: getOtpNotificationMessage({
          config,
          code: otpCode,
          purpose: "registration",
        }),
        channels: ["system", "sms"],
        destinationPhone: normalizedPhone,
      });
      const marketManager = await getManagerForMarket(market.id);
      if (marketManager) {
        await queueNotification({
          userId: marketManager.id,
          type: "system",
          message: `New vendor registration for ${market.name}: ${name} is awaiting approval.`,
          channels: ["system", "sms"],
          destinationPhone: marketManager.phone,
        });
      }

      sendJson(res, 201, {
        challengeId,
        expiresAt,
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
    path: "/auth/managers",
    handler: async ({ req, res, auth, config }) => {
      const session = requireAuth(auth);
      if (session.user.role !== "admin") {
        throw new HttpError(403, "Only admins can assign market managers.");
      }

      const body = await readJsonBody<{
        name?: string;
        email?: string;
        phone?: string;
        marketId?: string;
      }>(req);

      const name = body.name?.trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone ? normalizePhoneNumber(body.phone) : undefined;
      const marketId = body.marketId?.trim();

      if (!name || !email || !phone || !marketId) {
        throw new HttpError(400, "Name, email, phone, and market are required.");
      }

      const market = await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const existingManager = await get<{
        id: string;
        auth_user_id: string | null;
      }>(
        `SELECT id, auth_user_id
         FROM users
         WHERE role = 'manager' AND market_id = ?
         ORDER BY created_at ASC
         LIMIT 1`,
        [market.id],
      );

      const duplicatePhone = await get<{ id: string }>(
        `SELECT id
         FROM users
         WHERE phone = ?${existingManager ? " AND id != ?" : ""}
         LIMIT 1`,
        existingManager ? [phone, existingManager.id] : [phone],
      );
      if (duplicatePhone) {
        throw new HttpError(409, "A user with that phone number already exists.");
      }

      const duplicateEmail = await get<{ id: string }>(
        `SELECT id
         FROM users
         WHERE email = ?${existingManager ? " AND id != ?" : ""}
         LIMIT 1`,
        existingManager ? [email, existingManager.id] : [email],
      );
      if (duplicateEmail) {
        throw new HttpError(409, "A user with that email address already exists.");
      }

      const managerUserId = existingManager?.id || createId("user");
      let authUserId = existingManager?.auth_user_id || null;
      if (config.supabaseAuthEnabled) {
        const matchingSupabaseUser = await findSupabaseAuthUser({ phone, email });
        if (matchingSupabaseUser && matchingSupabaseUser.id !== authUserId) {
          throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
        }
      }

      const temporaryPassword = createTemporaryPassword();
      if (config.supabaseAuthEnabled) {
        if (authUserId) {
          const authUser = await updateSupabaseAuthUser(authUserId, {
            email,
            phone,
            password: temporaryPassword,
            localUserId: managerUserId,
            name,
            role: "manager",
            marketId: market.id,
          });
          authUserId = authUser?.id || authUserId;
        } else {
          const authUser = await createSupabaseAuthUser({
            email,
            phone,
            password: temporaryPassword,
            localUserId: managerUserId,
            name,
            role: "manager",
            marketId: market.id,
          });
          authUserId = authUser?.id || null;
        }
      }

      const timestamp = nowIso();
      await transaction(async () => {
        if (existingManager) {
          await run(
            `UPDATE users
             SET auth_user_id = ?,
                 name = ?,
                 email = ?,
                 phone = ?,
                 password_hash = ?,
                 role = 'manager',
                 market_id = ?,
                 mfa_enabled = 1,
                 phone_verified_at = ?,
                 updated_at = ?
             WHERE id = ?`,
            [authUserId, name, email, phone, hashPassword(temporaryPassword), market.id, timestamp, timestamp, managerUserId],
          );
          await run(`DELETE FROM sessions WHERE user_id = ?`, [managerUserId]);
        } else {
          await run(
            `INSERT INTO users (id, auth_user_id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'manager', ?, 1, ?, ?, ?)`,
            [managerUserId, authUserId, name, email, phone, hashPassword(temporaryPassword), market.id, timestamp, timestamp, timestamp],
          );
        }
      });

      await queueNotification({
        userId: managerUserId,
        type: "system",
        message: `You are assigned as manager for ${market.name}. Temporary password: ${temporaryPassword}. Sign in at ${config.appUrl} and an OTP will be sent to this phone.`,
        channels: ["system", "sms"],
        destinationPhone: phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: market.id,
        action: "ASSIGN_MANAGER",
        entityType: "manager",
        entityId: managerUserId,
        details: { managerName: name, created: !existingManager },
      });

      const manager = await getUserRecordById(managerUserId);
      if (!manager) {
        throw new HttpError(500, "Unable to load the assigned manager.");
      }

      sendJson(res, 201, {
        manager: serializeAuthUser(manager),
        message: `Manager setup instructions were sent to ${phone}.`,
      });
    },
  },
  {
    method: "POST",
    path: "/auth/login",
    handler: async ({ req, res, config }) => {
      const body = await readJsonBody<{ phone: string; password: string }>(req);
      const user = await getUserRecordByPhone(normalizePhoneNumber(body.phone || ""));
      if (!user) {
        throw new HttpError(401, "Invalid phone number or password.");
      }

      const password = body.password || "";
      const isLocalPasswordValid = verifyPassword(password, user.password_hash);
      const supabaseUser =
        !isLocalPasswordValid && config.supabaseAuthEnabled && user.auth_user_id
          ? await verifySupabaseCredentials({
              phone: user.phone,
              password,
            })
          : null;
      const isPasswordValid = isLocalPasswordValid || supabaseUser?.id === user.auth_user_id;

      if (!isPasswordValid) {
        throw new HttpError(401, "Invalid phone number or password.");
      }

      if (user.role === "vendor") {
        if (!user.phone_verified_at) {
          const challenge = await issueRegistrationChallenge({
            userId: user.id,
            phone: user.phone,
            config,
          });

          sendJson(res, 200, {
            verificationRequired: true,
            challengeId: challenge.challengeId,
            expiresAt: challenge.expiresAt,
          });
          return;
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
        const expiresAt = addMinutes(config.otpTtlMinutes);
        await run(
          `INSERT INTO otp_challenges (id, user_id, purpose, phone, code_hash, expires_at, verified_at, metadata_json, created_at)
           VALUES (?, ?, 'manager_mfa', ?, ?, ?, NULL, NULL, ?)`,
          [challengeId, user.id, user.phone, hashOtpCode(otpCode), expiresAt, timestamp],
        );
        await queueNotification({
          userId: user.id,
          type: "otp",
          message: getOtpNotificationMessage({
            config,
            code: otpCode,
            purpose: "login",
          }),
          channels: ["system", "sms"],
          destinationPhone: user.phone,
        });

        sendJson(res, 200, {
          mfaRequired: true,
          challengeId,
          expiresAt,
        });
        return;
      }

      const token = await createSessionForUser(user.id);
      await logLoginSuccess(user, false);
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
      await logLoginSuccess(user, true);
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
      await logLoginSuccess(user, true);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/change-password",
    handler: async ({ req, res, auth }) => {
      const session = requireAuth(auth);
      const body = await readJsonBody<{ currentPassword?: string; newPassword?: string }>(req);
      const currentPassword = body.currentPassword || "";
      const newPassword = body.newPassword || "";

      if (!currentPassword || !newPassword) {
        throw new HttpError(400, "Current password and new password are required.");
      }
      if (currentPassword === newPassword) {
        throw new HttpError(400, "New password must be different from the current password.");
      }

      const user = await getUserRecordById(session.user.id);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      if (!verifyPassword(currentPassword, user.password_hash)) {
        throw new HttpError(401, "Current password is incorrect.");
      }

      await applyUserPassword(user, newPassword);
      await revokeUserSessions({
        userId: user.id,
        exceptTokenHash: hashToken(session.token),
      });

      await logAuditEvent({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        marketId: user.market_id,
        action: "CHANGE_PASSWORD",
        entityType: "user",
        entityId: user.id,
      });

      sendJson(res, 200, { message: "Password updated." });
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
    method: "PATCH",
    path: "/auth/me",
    handler: async ({ req, res, auth, config }) => {
      const session = requireAuth(auth);
      const body = await readJsonBody<{ name?: string; email?: string; phone?: string }>(req);
      const name = body.name?.trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone ? normalizePhoneNumber(body.phone) : undefined;

      if (!name || !email || !phone) {
        throw new HttpError(400, "Name, email, and phone are required.");
      }

      const user = await getUserRecordById(session.user.id);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      const duplicatePhone = await get<{ id: string }>(
        `SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1`,
        [phone, user.id],
      );
      if (duplicatePhone) {
        throw new HttpError(409, "A user with that phone number already exists.");
      }

      const duplicateEmail = await get<{ id: string }>(
        `SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1`,
        [email, user.id],
      );
      if (duplicateEmail) {
        throw new HttpError(409, "A user with that email address already exists.");
      }

      if (config.supabaseAuthEnabled && user.auth_user_id) {
        const matchingSupabaseUser = await findSupabaseAuthUser({ phone, email });
        if (matchingSupabaseUser && matchingSupabaseUser.id !== user.auth_user_id) {
          throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
        }

        await updateSupabaseAuthUser(user.auth_user_id, {
          email,
          phone,
          localUserId: user.id,
          name,
          role: user.role,
          marketId: user.market_id,
        });
      }

      const timestamp = nowIso();
      await run(
        `UPDATE users
         SET name = ?,
             email = ?,
             phone = ?,
             phone_verified_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [name, email, phone, phone !== user.phone ? timestamp : user.phone_verified_at, timestamp, user.id],
      );

      await logAuditEvent({
        actorUserId: user.id,
        actorName: name,
        actorRole: user.role,
        marketId: user.market_id,
        action: "UPDATE_OWN_PROFILE",
        entityType: "user",
        entityId: user.id,
        details: {
          phoneChanged: phone !== user.phone,
          emailChanged: email !== user.email,
        },
      });

      const updatedUser = await getUserRecordById(user.id);
      if (!updatedUser) {
        throw new HttpError(404, "User not found.");
      }

      sendJson(res, 200, {
        user: serializeAuthUser(updatedUser),
        message: "Profile updated.",
      });
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
