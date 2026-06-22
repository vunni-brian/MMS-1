/**
 * Provisions (creates or updates) test users and a demo market in the local database,
 * syncing each user to Supabase Auth. Used for hosted/demo test environments.
 */
import { pathToFileURL } from "node:url";

import { all, closeDatabase, initDatabase, run, transaction } from "../server/lib/db.ts";
import { hashPassword, normalizePhoneNumber, nowIso } from "../server/lib/security.ts";
import { syncSeedUserToSupabase } from "../server/lib/supabase.ts";
import type { Role } from "../server/types.ts";

/** Specification for a single test user to be provisioned. */
type TestUserSpec = {
  /** Stable user ID used for idempotent upsert. */
  id: string;
  /** Display name for the user. */
  name: string;
  /** Email address (also used for Supabase Auth). */
  email: string;
  /** E.164 phone number. */
  phone: string;
  /** System role assigned to the user. */
  role: Role;
  /** Plain-text password that will be hashed before storage. */
  password: string;
};

/** Shape of an existing user row fetched from the database for deduplication. */
type ExistingUserRow = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: Role;
  market_id: string | null;
  created_at: string;
};

/** Demo market created alongside test users for manager/vendor role assignments. */
const hostedTestMarket = {
  id: "market_demo_test",
  name: "MMS Demo Test Market",
  code: "MMS-DEMO",
  location: "Hosted Testbed",
} as const;

/** The full set of test users to provision for the hosted demo environment. */
const hostedTestUsers: TestUserSpec[] = [
  {
    id: "user_admin_vunni",
    name: "Vunni Brian",
    email: "vunnibrian14@gmail.com",
    phone: "+256764854885",
    role: "admin",
    password: "Admin123!",
  },
  {
    id: "user_manager_kigozi",
    name: "Kigozi Duncan",
    email: "kigoziduncan72@gmail.com",
    phone: "+256743180351",
    role: "manager",
    password: "Manager123!",
  },
  {
    id: "user_official_nassanga",
    name: "Nassanga Shakirah Kakembo",
    email: "nassanga681@gmail.com",
    phone: "+256758616651",
    role: "official",
    password: "Official123!",
  },
  {
    id: "user_vendor_kakembo_james",
    name: "Kakembo James",
    email: "jameskakembotj@gmail.com",
    phone: "+256705366092",
    role: "vendor",
    password: "Vendor123!",
  },
  {
    id: "user_vendor_kemigisha_precious",
    name: "Kemigisha Precious Loy",
    email: "preciousloy175@gmail.com",
    phone: "+256760749576",
    role: "vendor",
    password: "Vendor123!",
  },
];

/** Deduplicates an array of objects by their `id` property, keeping the last occurrence. */
const uniqueById = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map((row) => [row.id, row])).values());

/**
 * Looks up an existing user by id, email, or phone to decide
 * whether to create or update the record.
 */
const resolveExistingUser = async (user: TestUserSpec) => {
  const matches = uniqueById(
    await all<ExistingUserRow>(
      `SELECT id, auth_user_id, name, email, phone, role, market_id, created_at
       FROM users
       WHERE id = ? OR LOWER(email) = LOWER(?) OR phone = ?
       ORDER BY created_at ASC`,
      [user.id, user.email.trim().toLowerCase(), normalizePhoneNumber(user.phone)],
    ),
  );

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous local user match for ${user.name}: ${matches
        .map((match) => `${match.id} (${match.role}, ${match.email}, ${match.phone})`)
        .join(", ")}`,
    );
  }

  return matches[0] ?? null;
};

/** Ensures the hosted demo market exists, creating or updating it as needed. */
const resolveHostedTestMarket = async () => {
  const matches = uniqueById(
    await all<{ id: string; code: string }>(
      `SELECT id, code
       FROM markets
       WHERE id = ? OR code = ?
       ORDER BY created_at ASC`,
      [hostedTestMarket.id, hostedTestMarket.code],
    ),
  );

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous hosted test market match: ${matches.map((match) => `${match.id} (${match.code})`).join(", ")}`,
    );
  }

  if (!matches[0]) {
    const timestamp = nowIso();
    await run(
      `INSERT INTO markets (id, name, code, location, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [hostedTestMarket.id, hostedTestMarket.name, hostedTestMarket.code, hostedTestMarket.location, timestamp],
    );
    return { id: hostedTestMarket.id, created: true };
  }

  await run(
    `UPDATE markets
     SET name = ?,
         code = ?,
         location = ?
     WHERE id = ?`,
    [hostedTestMarket.name, hostedTestMarket.code, hostedTestMarket.location, matches[0].id],
  );

  return { id: matches[0].id, created: false };
};

/** Ensures no other local user is already linked to the given Supabase Auth user ID. */
const ensureUniqueAuthLink = async (authUserId: string, localUserId: string) => {
  const linkedUsers = await all<{ id: string }>(
    `SELECT id
     FROM users
     WHERE auth_user_id = ? AND id != ?`,
    [authUserId, localUserId],
  );

  if (linkedUsers.length > 0) {
    throw new Error(`Supabase Auth user ${authUserId} is already linked to local user ${linkedUsers[0].id}.`);
  }
};

/** Creates or updates a vendor_profile record with approved status for the given user. */
const upsertVendorProfile = async ({
  userId,
  approvedBy,
  approvedAt,
}: {
  userId: string;
  approvedBy: string | null;
  approvedAt: string;
}) => {
  await run(
    `INSERT OR IGNORE INTO vendor_profiles (
       user_id,
       approval_status,
       approval_reason,
       approved_by,
       approved_at,
       rejected_by,
       rejected_at
     )
     VALUES (?, 'approved', NULL, ?, ?, NULL, NULL)`,
    [userId, approvedBy, approvedAt],
  );

  await run(
    `UPDATE vendor_profiles
     SET approval_status = 'approved',
         approval_reason = NULL,
         approved_by = ?,
         approved_at = ?,
         rejected_by = NULL,
         rejected_at = NULL
     WHERE user_id = ?`,
    [approvedBy, approvedAt, userId],
  );
};

/**
 * Main provisioning routine: resolves or creates the demo market, then
 * iterates over all test users — creating or updating each one, syncing
 * to Supabase Auth, and setting up vendor profiles where applicable.
 */
export const provisionHostedTestUsers = async () => {
  await initDatabase();

  const resolvedMarket = await resolveHostedTestMarket();
  const resolvedIds = new Map<string, string>();
  const results: Array<{
    requestedId: string;
    actualId: string;
    role: Role;
    phone: string;
    marketId: string | null;
    action: "created" | "updated";
  }> = [];

  for (const user of hostedTestUsers) {
    const existing = await resolveExistingUser(user);
    const actualUserId = existing?.id ?? user.id;
    const email = user.email.trim().toLowerCase();
    const phone = normalizePhoneNumber(user.phone);
    const timestamp = nowIso();
    const marketId = user.role === "manager" || user.role === "vendor" ? resolvedMarket.id : null;
    const mfaEnabled = user.role === "vendor" ? 0 : 1;

    const authUser = await syncSeedUserToSupabase({
      email,
      phone,
      password: user.password,
      localUserId: actualUserId,
      name: user.name,
      role: user.role,
      marketId,
    });

    if (authUser?.id) {
      await ensureUniqueAuthLink(authUser.id, actualUserId);
    }

    await transaction(async () => {
      if (existing) {
        await run(
          `UPDATE users
           SET auth_user_id = ?,
               name = ?,
               email = ?,
               phone = ?,
               password_hash = ?,
               role = ?,
               market_id = ?,
               mfa_enabled = ?,
               phone_verified_at = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            authUser?.id ?? existing.auth_user_id,
            user.name,
            email,
            phone,
            hashPassword(user.password),
            user.role,
            marketId,
            mfaEnabled,
            timestamp,
            timestamp,
            actualUserId,
          ],
        );
      } else {
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
             created_at,
             updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualUserId,
            authUser?.id ?? null,
            user.name,
            email,
            phone,
            hashPassword(user.password),
            user.role,
            marketId,
            mfaEnabled,
            timestamp,
            timestamp,
            timestamp,
          ],
        );
      }

      await run(`DELETE FROM sessions WHERE user_id = ?`, [actualUserId]);

      if (user.role === "vendor") {
        await upsertVendorProfile({
          userId: actualUserId,
          approvedBy: resolvedIds.get("user_admin_vunni") ?? null,
          approvedAt: timestamp,
        });
      } else {
        await run(`DELETE FROM vendor_profiles WHERE user_id = ?`, [actualUserId]);
      }
    });

    resolvedIds.set(user.id, actualUserId);
    results.push({
      requestedId: user.id,
      actualId: actualUserId,
      role: user.role,
      phone,
      marketId,
      action: existing ? "updated" : "created",
    });
  }

  return {
    market: {
      id: resolvedMarket.id,
      created: resolvedMarket.created,
    },
    users: results,
  };
};

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    const result = await provisionHostedTestUsers();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeDatabase();
  }
}
