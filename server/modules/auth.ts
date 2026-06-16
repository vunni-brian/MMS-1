import fs from "node:fs";

import {
  all,
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

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
import { HttpError, readJsonBody, sendEmpty, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMaxLength, MAX_DEPARTMENT_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_EMAIL_LENGTH, MAX_IDENTIFIER_LENGTH, MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_REASON_LENGTH, MAX_REGION_LENGTH, sanitizeText } from "../lib/text-utils.ts";
import { getOtpNotificationMessage } from "../lib/otp-messages.ts";
import { applyUserPassword, revokeUserSessions, validatePasswordStrength } from "../lib/passwords.ts";
import { rolePermissions } from "../lib/permissions.ts";
import { assertMarketAccess, createSessionForUser, destroySession, requireAuth } from "../lib/session.ts";
import {
  addMinutes,
  createOtpCode,
  createTemporaryPassword,
  hashOtpCode,
  hashPassword,
  hashToken,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizePhoneNumber,
  nowIso,
  verifyOtpCode,
  verifyPassword,
} from "../lib/security.ts";
import { createSupabaseAuthUser, deleteSupabaseAuthUser, downloadSupabaseStorageObject, findSupabaseAuthUser, updateSupabaseAuthUser, verifySupabaseCredentials } from "../lib/supabase.ts";
import { persistFilePayload, removeStoredFile, validateFilePayload } from "../lib/storage.ts";
import type { FilePayload, Permission, Role, StaffAccount, StaffStatus } from "../types.ts";

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

const logLoginFailure = async (
  user: {
    id: string;
    name: string;
    phone: string;
    role: "vendor" | "manager" | "official" | "admin";
    market_id: string | null;
    failed_login_attempts?: number;
  },
  reason: string,
) => {
  await logAuditEvent({
    actorUserId: user.id,
    actorName: user.name,
    actorRole: user.role,
    marketId: user.market_id,
    action: reason === "rejected_vendor" ? "LOGIN_BLOCKED_REJECTED_VENDOR" : "LOGIN_FAILED",
    entityType: "user",
    entityId: user.id,
    details: {
      phone: user.phone,
      reason,
    },
  });

  if (reason === "invalid_password") {
    const attempts = (user.failed_login_attempts ?? 0) + 1;
    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockDuration = `${LOCKOUT_DURATION_MINUTES} minutes`;
      await run(
        `UPDATE users SET failed_login_attempts = ?, locked_until = NOW() + INTERVAL ? WHERE id = ?`,
        [attempts, lockDuration, user.id],
      );
    } else {
      await run(`UPDATE users SET failed_login_attempts = ? WHERE id = ?`, [attempts, user.id]);
    }
  }
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

type StaffRole = Extract<Role, "manager" | "official">;

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  market_id: string | null;
  market_name: string | null;
  department: string | null;
  assigned_region: string | null;
  staff_identifier: string | null;
  access_level: string | null;
  staff_status: StaffStatus | null;
  permission_scope_json: string | null;
  responsibilities_json: string | null;
  vendor_status: string | null;
  created_at: string;
  last_active_at: string | null;
}

const staffAccountSelect = `
  SELECT users.id,
         users.name,
         users.email,
         users.phone,
         users.role,
         users.market_id,
         markets.name AS market_name,
         staff_profiles.department,
         staff_profiles.assigned_region,
         staff_profiles.staff_identifier,
         staff_profiles.access_level,
         staff_profiles.status AS staff_status,
         staff_profiles.permission_scope_json,
         staff_profiles.responsibilities_json,
         vendor_profiles.approval_status AS vendor_status,
         users.created_at,
         (
           SELECT MAX(audit_events.created_at)
           FROM audit_events
           WHERE audit_events.actor_user_id = users.id
              OR (audit_events.actor_name = users.name AND audit_events.actor_role = users.role)
         ) AS last_active_at
  FROM users
  LEFT JOIN markets ON markets.id = users.market_id
  LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
  LEFT JOIN vendor_profiles ON vendor_profiles.user_id = users.id
`;

const knownPermissions = new Set<Permission>(Object.values(rolePermissions).flat());

const parseStringArray = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      : [];
  } catch {
    return [];
  }
};

const sanitizePermissionScope = (role: StaffRole, permissions?: unknown) => {
  if (!Array.isArray(permissions)) {
    return rolePermissions[role];
  }

  const defaultScope = new Set(rolePermissions[role]);
  const scopedPermissions = permissions.filter(
    (permission): permission is Permission =>
      typeof permission === "string" && knownPermissions.has(permission as Permission) && defaultScope.has(permission as Permission),
  );
  const uniquePermissions = [...new Set(scopedPermissions)];
  return uniquePermissions.length > 0 ? uniquePermissions : rolePermissions[role];
};

const getAccountPermissions = (row: StaffAccountRow): Permission[] => {
  if (row.role !== "manager" && row.role !== "official") {
    return rolePermissions[row.role];
  }

  return sanitizePermissionScope(row.role, parseStringArray(row.permission_scope_json));
};

const getAccountStatus = (row: StaffAccountRow): StaffStatus => {
  if (row.staff_status === "active" || row.staff_status === "pending" || row.staff_status === "suspended") {
    return row.staff_status;
  }

  if (row.role === "vendor") {
    if (row.vendor_status === "approved") return "active";
    if (row.vendor_status === "rejected") return "suspended";
    return "pending";
  }

  return "active";
};

const mapStaffAccount = (row: StaffAccountRow): StaffAccount => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  department: row.department,
  assignedRegion: row.assigned_region,
  staffIdentifier: row.staff_identifier,
  accessLevel: row.access_level || (row.role === "admin" ? "full" : "standard"),
  status: getAccountStatus(row),
  permissions: getAccountPermissions(row),
  responsibilities: parseStringArray(row.responsibilities_json),
  marketId: row.market_id,
  marketName: row.market_name,
  createdAt: row.created_at,
  lastActiveAt: row.last_active_at,
  vendorStatus: row.vendor_status as StaffAccount["vendorStatus"],
});

const listStaffAccounts = async (limit = 50, offset = 0) =>
  (
    await all<StaffAccountRow>(
      `${staffAccountSelect}
       ORDER BY CASE users.role
                  WHEN 'admin' THEN 1
                  WHEN 'manager' THEN 2
                  WHEN 'official' THEN 3
                  WHEN 'vendor' THEN 4
                  ELSE 5
                END,
                users.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    )
  ).map(mapStaffAccount);

const getStaffAccountById = async (userId: string) => {
  const row = await get<StaffAccountRow>(
    `${staffAccountSelect}
     WHERE users.id = ?`,
    [userId],
  );
  return row ? mapStaffAccount(row) : null;
};

const assertCanManageUsers = (user: { permissions: Permission[] }) => {
  if (!user.permissions.includes("auth:manage")) {
    throw new HttpError(403, "User administration requires auth management permission.");
  }
};

const handleVerifyMfa: RouteDefinition["handler"] = async ({ req, res }) => {
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
};

export const authRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/auth/users",
    handler: async ({ res, auth, url }) => {
      const session = requireAuth(auth);
      assertCanManageUsers(session.user);
      const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || 50)), 100);
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

      sendJson(res, 200, {
        users: await listStaffAccounts(limit, offset),
      });
    },
  },
  {
    method: "POST",
    path: "/auth/staff",
    handler: async ({ req, res, auth, config }) => {
      const session = requireAuth(auth);
      assertCanManageUsers(session.user);

      const body = await readJsonBody<{
        firstName?: string;
        lastName?: string;
        name?: string;
        email?: string;
        phone?: string;
        role?: Role;
        marketId?: string | null;
        department?: string;
        assignedRegion?: string;
        staffIdentifier?: string;
        accessLevel?: string;
        status?: StaffStatus;
        permissions?: Permission[];
        responsibilities?: string[];
        temporaryPassword?: string;
      }>(req);

      if (body.role !== "manager" && body.role !== "official") {
        throw new HttpError(400, "Role must be manager or official.");
      }

      const role = body.role;
      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      let name = body.name?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone ? normalizePhoneNumber(body.phone) : undefined;
      let department = body.department?.trim();
      let assignedRegion = body.assignedRegion?.trim();
      const staffIdentifier = body.staffIdentifier?.trim() || null;
      const accessLevel = body.accessLevel?.trim() || (role === "official" ? "regional_compliance" : "market_supervision");
      const status: StaffStatus =
        body.status === "pending" || body.status === "suspended" || body.status === "active" ? body.status : "active";
      const marketId = body.marketId?.trim() || null;

      if (!name || !email || !phone || !department || !assignedRegion) {
        throw new HttpError(400, "Name, email, phone, department, and assigned region are required.");
      }
      assertMaxLength(name, MAX_NAME_LENGTH, "Name");
      assertMaxLength(email, MAX_EMAIL_LENGTH, "Email");
      assertMaxLength(department, MAX_DEPARTMENT_LENGTH, "Department");
      assertMaxLength(assignedRegion, MAX_REGION_LENGTH, "Assigned region");
      assertMaxLength(staffIdentifier, MAX_IDENTIFIER_LENGTH, "Staff identifier");
      name = sanitizeText(name);
      department = sanitizeText(department);
      assignedRegion = sanitizeText(assignedRegion);
      if (role === "manager" && !marketId) {
        throw new HttpError(400, "Managers must be assigned to a market.");
      }
      if (role === "official" && !staffIdentifier) {
        throw new HttpError(400, "Officials must have a government or staff identifier.");
      }
      if (!isValidEmailAddress(email)) {
        throw new HttpError(400, "A valid email address is required.");
      }
      if (!isValidPhoneNumber(phone)) {
        throw new HttpError(400, "A valid international phone number is required.");
      }

      const market = marketId ? await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [marketId]) : null;
      if (marketId && !market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const existingPhone = await get<{ id: string }>(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [phone]);
      const existingEmail = await get<{ id: string }>(`SELECT id FROM users WHERE lower(email) = ? LIMIT 1`, [email]);
      if (existingPhone || existingEmail) {
        throw new HttpError(409, "A user with that phone or email already exists.");
      }

      if (config.supabaseAuthEnabled) {
        const matchingSupabaseUser = await findSupabaseAuthUser({ phone, email });
        if (matchingSupabaseUser) {
          throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
        }
      }

      const userId = createId("user");
      const temporaryPassword = body.temporaryPassword?.trim() || createTemporaryPassword();
      validatePasswordStrength(temporaryPassword);
      const timestamp = nowIso();
      const permissionScope = sanitizePermissionScope(role, body.permissions);
      const responsibilities =
        Array.isArray(body.responsibilities) && body.responsibilities.some((item) => item.trim())
          ? body.responsibilities.map((item) => item.trim()).filter(Boolean)
          : role === "official"
            ? ["Vendor Compliance", "Utility Monitoring", "Complaints Oversight"]
            : ["Workflow Supervision", "Vendor Approvals", "Operational Monitoring"];

      let authUserId: string | null = null;
      try {
        if (config.supabaseAuthEnabled) {
          const authUser = await createSupabaseAuthUser({
            email,
            phone,
            password: temporaryPassword,
            localUserId: userId,
            name,
            role,
            marketId: market?.id || null,
          });
          authUserId = authUser?.id || null;
        }

        await transaction(async () => {
          await run(
            `INSERT INTO users (id, auth_user_id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [userId, authUserId, name, email, phone, hashPassword(temporaryPassword), role, market?.id || null, timestamp, timestamp, timestamp],
          );
          await run(
            `INSERT INTO staff_profiles (
               user_id,
               department,
               assigned_region,
               staff_identifier,
               access_level,
               status,
               permission_scope_json,
               responsibilities_json,
               created_by,
               created_at,
               updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              department,
              assignedRegion,
              staffIdentifier,
              accessLevel,
              status,
              JSON.stringify(permissionScope),
              JSON.stringify(responsibilities),
              session.user.id,
              timestamp,
              timestamp,
            ],
          );
        });
      } catch (error) {
        if (authUserId) {
          await deleteSupabaseAuthUser(authUserId);
        }
        throw error;
      }

      await queueNotification({
        userId,
        type: "system",
        message: `You have been invited as ${role} for ${market?.name || assignedRegion}. Temporary password: ${temporaryPassword}. Sign in at ${config.appUrl} and complete MFA to activate your workspace.`,
        channels: ["system", "sms", "email"],
        destinationPhone: phone,
        destinationEmail: email,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: market?.id || null,
        action: "INVITE_STAFF_ACCOUNT",
        entityType: "user",
        entityId: userId,
        details: {
          role,
          department,
          assignedRegion,
          accessLevel,
          status,
          permissions: permissionScope,
        },
      });

      const account = await getStaffAccountById(userId);
      if (!account) {
        throw new HttpError(500, "Unable to load invited staff account.");
      }

      sendJson(res, 201, {
        user: account,
        message: `Invite and role assignment were sent to ${phone}.`,
      });
    },
  },
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
        productSection: string;
        profileImage: FilePayload | null;
        idDocument: FilePayload | null;
        lcLetter: FilePayload | null;
      }>(req);

      let name = body.name?.trim();
      const email = body.email?.trim().toLowerCase();
      let nationalIdNumber = body.nationalIdNumber?.trim().toUpperCase();
      let district = body.district?.trim();
      let productSection = body.productSection?.trim();
      const normalizedPhone = normalizePhoneNumber(body.phone || "");

      if (!name || !email || !normalizedPhone || !body.password || !body.marketId || !nationalIdNumber || !district || !productSection) {
        throw new HttpError(400, "Name, email, phone, password, market, NIN, district, and product section are required.");
      }
      assertMaxLength(name, MAX_NAME_LENGTH, "Name");
      assertMaxLength(email, MAX_EMAIL_LENGTH, "Email");
      assertMaxLength(nationalIdNumber, MAX_IDENTIFIER_LENGTH, "National ID number");
      assertMaxLength(district, MAX_DEPARTMENT_LENGTH, "District");
      assertMaxLength(productSection, MAX_DESCRIPTION_LENGTH, "Product section");
      name = sanitizeText(name);
      nationalIdNumber = sanitizeText(nationalIdNumber);
      district = sanitizeText(district);
      productSection = sanitizeText(productSection);
      if (!isValidEmailAddress(email)) {
        throw new HttpError(400, "A valid email address is required.");
      }
      if (!isValidPhoneNumber(normalizedPhone)) {
        throw new HttpError(400, "A valid international phone number is required.");
      }
      validatePasswordStrength(body.password);

      validateFilePayload(body.profileImage, ["image/jpeg", "image/png", "image/webp"], false);
      validateFilePayload(body.idDocument, ["application/pdf", "image/jpeg", "image/png"], true);
      validateFilePayload(body.lcLetter, ["application/pdf", "image/jpeg", "image/png"], true);

      const market = await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [body.marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const existingPhone = await get<{ id: string }>(`SELECT id FROM users WHERE phone = ?`, [normalizedPhone]);
      const existingEmail = await get<{ id: string }>(`SELECT id FROM users WHERE lower(email) = ?`, [email]);
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
      let storedProfileImagePath: string | null = null;
      let storedDocumentPath: string | null = null;
      let storedLcLetterPath: string | null = null;

      try {
        if (config.supabaseAuthEnabled) {
          const existingSupabaseUser = await findSupabaseAuthUser({
            phone: normalizedPhone,
            email,
          });
          if (existingSupabaseUser) {
            throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
          }

          const authUser = await createSupabaseAuthUser({
            email,
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
        const profileImage = body.profileImage ? await persistFilePayload("profile-images", userId, body.profileImage) : null;
        storedProfileImagePath = profileImage?.storagePath || null;

        await transaction(async () => {
          await run(
            `INSERT INTO users (
               id,
               auth_user_id,
               name,
               email,
               phone,
               password_hash,
               role,
               market_id,
               mfa_enabled,
               phone_verified_at,
               profile_image_name,
               profile_image_path,
               profile_image_mime_type,
               profile_image_size,
               created_at,
               updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, 'vendor', ?, 0, NULL, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              authUserId,
              name,
              email,
              normalizedPhone,
              hashPassword(body.password),
              market.id,
              profileImage?.name || null,
              profileImage?.storagePath || null,
              profileImage?.mimeType || null,
              profileImage?.size || null,
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
               product_section,
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
             VALUES (?, 'pending', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
            [
              userId,
              nationalIdNumber,
              district,
              productSection,
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
        await removeStoredFile(storedProfileImagePath);
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

      const user = await getUserRecordById(challenge.user_id!);
      if (!user) {
        throw new HttpError(404, "User not found for registration challenge.");
      }

      const token = await createSessionForUser(user.id);
      await logLoginSuccess(user, false);
      sendJson(res, 200, {
        token,
        user: serializeAuthUser(user),
        status: "pending_approval",
        message: "Phone verified. Your dashboard is available while your vendor profile awaits manager approval.",
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

      let name = body.name?.trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone ? normalizePhoneNumber(body.phone) : undefined;
      const marketId = body.marketId?.trim();

      if (!name || !email || !phone || !marketId) {
        throw new HttpError(400, "Name, email, phone, and market are required.");
      }
      assertMaxLength(name, MAX_NAME_LENGTH, "Name");
      assertMaxLength(email, MAX_EMAIL_LENGTH, "Email");
      name = sanitizeText(name);
      if (!isValidEmailAddress(email)) {
        throw new HttpError(400, "A valid email address is required.");
      }
      if (!isValidPhoneNumber(phone)) {
        throw new HttpError(400, "A valid international phone number is required.");
      }

      const market = await get<{ id: string; name: string; location: string | null }>(`SELECT id, name, location FROM markets WHERE id = ?`, [marketId]);
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
         WHERE lower(email) = ?${existingManager ? " AND id != ?" : ""}
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
        await run(
          `INSERT INTO staff_profiles (
             user_id,
             department,
             assigned_region,
             staff_identifier,
             access_level,
             status,
             permission_scope_json,
             responsibilities_json,
             created_by,
             created_at,
             updated_at
           )
           VALUES (?, 'Market Operations', ?, NULL, 'market_supervision', 'active', ?, ?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE
           SET department = EXCLUDED.department,
               assigned_region = EXCLUDED.assigned_region,
               access_level = EXCLUDED.access_level,
               status = EXCLUDED.status,
               permission_scope_json = COALESCE(staff_profiles.permission_scope_json, EXCLUDED.permission_scope_json),
               responsibilities_json = EXCLUDED.responsibilities_json,
               updated_at = EXCLUDED.updated_at`,
          [
            managerUserId,
            market.location || market.name,
            JSON.stringify(rolePermissions.manager),
            JSON.stringify(["Workflow Supervision", "Vendor Approvals", "Operational Monitoring"]),
            session.user.id,
            timestamp,
            timestamp,
          ],
        );
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

      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000);
        throw new HttpError(429, `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
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
        await logLoginFailure(user, "invalid_password");
        throw new HttpError(401, "Invalid phone number or password.");
      }

      if (user.failed_login_attempts > 0 || user.locked_until) {
        await run(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`, [user.id]);
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
        if (user.vendor_status === "rejected") {
          await logLoginFailure(user, "rejected_vendor");
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
    handler: handleVerifyMfa,
  },
  {
    method: "POST",
    path: "/auth/verify-privileged-mfa",
    handler: handleVerifyMfa,
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
      const body = await readJsonBody<{
        name?: string;
        email?: string;
        phone?: string;
        profileImage?: FilePayload | null;
        removeProfileImage?: boolean;
      }>(req);
      let name = body.name?.trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone ? normalizePhoneNumber(body.phone) : undefined;

      if (!name || !email || !phone) {
        throw new HttpError(400, "Name, email, and phone are required.");
      }
      assertMaxLength(name, MAX_NAME_LENGTH, "Name");
      assertMaxLength(email, MAX_EMAIL_LENGTH, "Email");
      name = sanitizeText(name);
      if (!isValidEmailAddress(email)) {
        throw new HttpError(400, "A valid email address is required.");
      }
      if (!isValidPhoneNumber(phone)) {
        throw new HttpError(400, "A valid international phone number is required.");
      }
      validateFilePayload(body.profileImage, ["image/jpeg", "image/png", "image/webp"], false);

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
        `SELECT id FROM users WHERE lower(email) = ? AND id != ? LIMIT 1`,
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
      let nextProfileImage:
        | {
            name: string;
            storagePath: string;
            mimeType: string;
            size: number;
          }
        | null
        | undefined;
      let newProfileImagePath: string | null = null;

      if (body.profileImage) {
        nextProfileImage = await persistFilePayload("profile-images", user.id, body.profileImage);
        newProfileImagePath = nextProfileImage.storagePath;
      } else if (body.removeProfileImage) {
        nextProfileImage = null;
      }

      try {
        const profileImageSql =
          nextProfileImage === undefined
            ? ""
            : `,\n             profile_image_name = ?,\n             profile_image_path = ?,\n             profile_image_mime_type = ?,\n             profile_image_size = ?`;
        const profileImageParams =
          nextProfileImage === undefined
            ? []
            : nextProfileImage
              ? [nextProfileImage.name, nextProfileImage.storagePath, nextProfileImage.mimeType, nextProfileImage.size]
              : [null, null, null, null];

        await run(
          `UPDATE users
           SET name = ?,
               email = ?,
               phone = ?,
               phone_verified_at = ?,
               updated_at = ?${profileImageSql}
           WHERE id = ?`,
          [name, email, phone, phone !== user.phone ? timestamp : user.phone_verified_at, timestamp, ...profileImageParams, user.id],
        );

        if (nextProfileImage !== undefined) {
          await removeStoredFile(user.profile_image_path);
        }
      } catch (error) {
        await removeStoredFile(newProfileImagePath);
        throw error;
      }

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
          profileImageChanged: nextProfileImage !== undefined,
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
    path: "/users/:id/profile-image",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const target = await get<{
        id: string;
        role: "vendor" | "manager" | "official" | "admin";
        market_id: string | null;
        profile_image_name: string | null;
        profile_image_path: string | null;
        profile_image_mime_type: string | null;
      }>(
        `SELECT id, role, market_id, profile_image_name, profile_image_path, profile_image_mime_type
         FROM users
         WHERE id = ?`,
        [params.id],
      );

      if (!target || !target.profile_image_path || !target.profile_image_name) {
        throw new HttpError(404, "Profile image not found.");
      }
      if (session.user.id !== target.id) {
        if (session.user.role === "vendor") {
          throw new HttpError(403, "You may only view your own profile image.");
        }
        assertMarketAccess(session, target.market_id);
      }

      res.setHeader("Content-Type", target.profile_image_mime_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(target.profile_image_name)}"`);
      res.setHeader("Cache-Control", "private, max-age=60");

      if (target.profile_image_path.startsWith("supabase://")) {
        const buffer = await downloadSupabaseStorageObject(target.profile_image_path);
        if (!buffer) {
          throw new HttpError(404, "Profile image not found.");
        }
        res.writeHead(200);
        res.end(buffer);
        return;
      }

      if (!fs.existsSync(target.profile_image_path)) {
        throw new HttpError(404, "Profile image file is missing from storage.");
      }

      res.writeHead(200);
      fs.createReadStream(target.profile_image_path).pipe(res);
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
  {
    method: "POST",
    path: "/auth/unlock/:userId",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      assertCanManageUsers(session.user);
      const user = await getUserRecordById(params.userId);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      await run(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`, [params.userId]);
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: session.user.marketId,
        action: "UNLOCK_ACCOUNT",
        entityType: "user",
        entityId: params.userId,
        details: { unlockedBy: session.user.id, reason: "manual_admin_unlock" },
      });
      sendJson(res, 200, { ok: true, message: "Account unlocked." });
    },
  },
];
