import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { config } from "../config.ts";
import { rolePermissions } from "./permissions.ts";
import { hashPassword, nowIso } from "./security.ts";
import { syncSeedUserToSupabase } from "./supabase.ts";
import type { AuthUser, NotificationType, Role } from "../types.ts";

const { Pool, types } = pg;

// PostgreSQL returns bigint columns as strings by default. The counts and sums
// in this app are small enough to safely coerce into numbers.
types.setTypeParser(20, (value) => Number(value));

type DbClient = InstanceType<typeof Pool> | import("pg").PoolClient;
type TransactionContext = {
  client: import("pg").PoolClient;
  queue: Promise<void>;
};
type RunResult = { rowCount: number };

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations");
const transactionStorage = new AsyncLocalStorage<TransactionContext>();

const resolveSslConfig = (connectionString: string) =>
  config.databaseSsl && !connectionString.includes("sslmode=disable")
    ? { rejectUnauthorized: false }
    : undefined;

export const db = new Pool({
  connectionString: config.databaseUrl,
  ssl: resolveSslConfig(config.databaseUrl),
});

const migrationDb = new Pool({
  connectionString: config.migrationDatabaseUrl || config.databaseUrl,
  ssl: resolveSslConfig(config.migrationDatabaseUrl || config.databaseUrl),
});

const normalizeInsertOrIgnore = (sql: string) => {
  if (!/INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)) {
    return sql;
  }

  const replaced = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO").trimEnd().replace(/;$/, "");
  return `${replaced} ON CONFLICT DO NOTHING`;
};

const normalizePlaceholders = (sql: string) => {
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let previous = "";
  let normalized = "";

  for (const character of sql) {
    if (character === "'" && previous !== "\\" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (character === '"' && previous !== "\\" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (character === "?" && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      normalized += `$${index}`;
    } else {
      normalized += character;
    }

    previous = character;
  }

  return normalized;
};

const prepareSql = (sql: string) => normalizePlaceholders(normalizeInsertOrIgnore(sql));
const getClient = (): DbClient => transactionStorage.getStore()?.client ?? db;

const query = async <T>(sql: string, params: unknown[] = []) => {
  const text = prepareSql(sql);
  const transactionContext = transactionStorage.getStore();

  if (!transactionContext) {
    return db.query<T>(text, params);
  }

  const resultPromise = transactionContext.queue.then(() => transactionContext.client.query<T>(text, params));
  transactionContext.queue = resultPromise.then(() => undefined);
  return await resultPromise;
};

const readMigrationFiles = () => {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
};

export const run = async (sql: string, params: unknown[] = []): Promise<RunResult> => {
  const result = await query(sql, params);
  return { rowCount: result.rowCount ?? 0 };
};

export const get = async <T>(sql: string, params: unknown[] = []) => {
  const result = await query<T>(sql, params);
  return result.rows[0] as T | undefined;
};

export const all = async <T>(sql: string, params: unknown[] = []) => {
  const result = await query<T>(sql, params);
  return result.rows as T[];
};

export const transaction = async <T>(fn: () => Promise<T> | T) => {
  const activeContext = transactionStorage.getStore();
  if (activeContext) {
    return await fn();
  }

  const client = await db.connect();
  const context: TransactionContext = {
    client,
    queue: Promise.resolve(),
  };
  try {
    await client.query("BEGIN");
    const result = await transactionStorage.run(context, async () => await fn());
    await context.queue;
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const initDatabase = async () => {
  const client = await migrationDb.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (
        await client.query<{ name: string }>(`SELECT name FROM schema_migrations ORDER BY name ASC`)
      ).rows.map((row) => row.name),
    );

    for (const fileName of readMigrationFiles()) {
      if (applied.has(fileName)) {
        continue;
      }

      const migrationSql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8").trim();
      if (!migrationSql) {
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migrationSql);
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [fileName]);
        await client.query("COMMIT");
        console.log(`Applied migration ${fileName}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
};

export const closeDatabase = async () => {
  await migrationDb.end();
  if (migrationDb !== db) {
    await db.end();
  }
};

export const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const isoFromDayOffset = (days: number, hour = 9) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
};

const isoFromMonthOffset = (months: number, day = 5) => {
  const value = new Date();
  value.setUTCMonth(value.getUTCMonth() + months, Math.min(day, 28));
  value.setUTCHours(9, 0, 0, 0);
  return value.toISOString();
};

const dateFromDayOffset = (days: number) => isoFromDayOffset(days, 12).slice(0, 10);

export const mapMarket = (row: {
  id: string;
  name: string;
  code: string;
  location: string;
  manager_user_id: string | null;
  manager_name: string | null;
  vendor_count: number;
  stall_count: number;
  active_stall_count: number;
  inactive_stall_count: number;
  maintenance_stall_count: number;
}) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  location: row.location,
  managerUserId: row.manager_user_id,
  managerName: row.manager_name,
  vendorCount: row.vendor_count,
  stallCount: row.stall_count,
  activeStallCount: row.active_stall_count,
  inactiveStallCount: row.inactive_stall_count,
  maintenanceStallCount: row.maintenance_stall_count,
});

export const listMarkets = async () =>
  (
    await all<{
      id: string;
      name: string;
      code: string;
      location: string;
      manager_user_id: string | null;
      manager_name: string | null;
      vendor_count: number;
      stall_count: number;
      active_stall_count: number;
      inactive_stall_count: number;
      maintenance_stall_count: number;
    }>(
      `SELECT markets.id,
              markets.name,
              markets.code,
              markets.location,
              managers.id AS manager_user_id,
              managers.name AS manager_name,
              COUNT(DISTINCT CASE WHEN vendors.role = 'vendor' THEN vendors.id END)::INT AS vendor_count,
              COUNT(DISTINCT stalls.id)::INT AS stall_count,
              COUNT(DISTINCT CASE WHEN stalls.status = 'active' THEN stalls.id END)::INT AS active_stall_count,
              COUNT(DISTINCT CASE WHEN stalls.status = 'inactive' THEN stalls.id END)::INT AS inactive_stall_count,
              COUNT(DISTINCT CASE WHEN stalls.status = 'maintenance' THEN stalls.id END)::INT AS maintenance_stall_count
       FROM markets
       LEFT JOIN users AS managers ON managers.market_id = markets.id AND managers.role = 'manager'
       LEFT JOIN users AS vendors ON vendors.market_id = markets.id AND vendors.role = 'vendor'
       LEFT JOIN stalls ON stalls.market_id = markets.id
       GROUP BY markets.id, managers.id, managers.name
       ORDER BY markets.name ASC`,
    )
  ).map(mapMarket);

export const getManagerForMarket = async (marketId: string) =>
  await get<{ id: string; name: string; phone: string }>(
    `SELECT id, name, phone
     FROM users
     WHERE role = 'manager' AND market_id = ?
     ORDER BY created_at ASC
     LIMIT 1`,
    [marketId],
  );

export const logAuditEvent = async ({
  actorUserId,
  actorName,
  actorRole,
  marketId,
  action,
  entityType,
  entityId,
  details,
}: {
  actorUserId: string | null;
  actorName: string;
  actorRole: Role;
  marketId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) => {
  await run(
    `INSERT INTO audit_events (id, actor_user_id, actor_name, actor_role, market_id, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId("audit"),
      actorUserId,
      actorName,
      actorRole,
      marketId ?? null,
      action,
      entityType,
      entityId,
      details ? JSON.stringify(details) : null,
      nowIso(),
    ],
  );
};

export const serializeAuthUser = (row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  created_at: string;
  phone_verified_at: string | null;
  vendor_status: string | null;
  market_id: string | null;
  market_name: string | null;
}): AuthUser => {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
    phoneVerifiedAt: row.phone_verified_at,
    vendorStatus: row.vendor_status as AuthUser["vendorStatus"],
    marketId: row.market_id,
    marketName: row.market_name,
    permissions: rolePermissions[row.role],
  };
};

export const getUserRecordById = async (userId: string) => {
  return await get<{
    id: string;
    auth_user_id: string | null;
    name: string;
    email: string;
    phone: string;
    password_hash: string;
    role: Role;
    mfa_enabled: number;
    phone_verified_at: string | null;
    created_at: string;
    vendor_status: string | null;
    market_id: string | null;
    market_name: string | null;
  }>(
    `SELECT users.id, users.auth_user_id, users.name, users.email, users.phone, users.password_hash, users.role, users.market_id, users.mfa_enabled, users.phone_verified_at, users.created_at, vendor_profiles.approval_status AS vendor_status, markets.name AS market_name
     FROM users
     LEFT JOIN vendor_profiles ON vendor_profiles.user_id = users.id
     LEFT JOIN markets ON markets.id = users.market_id
     WHERE users.id = ?`,
    [userId],
  );
};

export const getUserRecordByPhone = async (phone: string) => {
  return await get<{
    id: string;
    auth_user_id: string | null;
    name: string;
    email: string;
    phone: string;
    password_hash: string;
    role: Role;
    mfa_enabled: number;
    phone_verified_at: string | null;
    created_at: string;
    vendor_status: string | null;
    market_id: string | null;
    market_name: string | null;
  }>(
    `SELECT users.id, users.auth_user_id, users.name, users.email, users.phone, users.password_hash, users.role, users.market_id, users.mfa_enabled, users.phone_verified_at, users.created_at, vendor_profiles.approval_status AS vendor_status, markets.name AS market_name
     FROM users
     LEFT JOIN vendor_profiles ON vendor_profiles.user_id = users.id
     LEFT JOIN markets ON markets.id = users.market_id
     WHERE users.phone = ?`,
    [phone],
  );
};

export const getAuthUserById = async (userId: string) => {
  const user = await getUserRecordById(userId);
  return user ? serializeAuthUser(user) : null;
};

export const queueNotification = async ({
  userId,
  type,
  message,
  channels,
  destinationPhone,
  destinationEmail,
}: {
  userId: string;
  type: NotificationType;
  message: string;
  channels: ("system" | "sms" | "email")[];
  destinationPhone?: string | null;
  destinationEmail?: string | null;
}) => {
  const timestamp = nowIso();
  const notificationId = createId("notif");
  await run(
    `INSERT INTO notifications (id, user_id, type, message, read_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [notificationId, userId, type, message, timestamp],
  );

  if (channels.includes("sms") && destinationPhone) {
    await run(
      `INSERT INTO notification_deliveries (id, notification_id, channel, destination, status, attempts, next_attempt_at, last_error, created_at, updated_at)
       VALUES (?, ?, 'sms', ?, 'pending', 0, ?, NULL, ?, ?)`,
      [createId("delivery"), notificationId, destinationPhone, timestamp, timestamp, timestamp],
    );
  }

  if (channels.includes("email") && destinationEmail) {
    await run(
      `INSERT INTO notification_deliveries (id, notification_id, channel, destination, status, attempts, next_attempt_at, last_error, created_at, updated_at)
       VALUES (?, ?, 'email', ?, 'pending', 0, ?, NULL, ?, ?)`,
      [createId("delivery"), notificationId, destinationEmail, timestamp, timestamp, timestamp],
    );
  }

  return notificationId;
};

export const seedDatabase = async () => {
  const createdAt = nowIso();
  const markets = [
    {
      id: "market_kampala",
      name: "Kampala Central Market",
      code: "KLA-CENTRAL",
      location: "Kampala",
    },
    {
      id: "market_jinja",
      name: "Jinja Main Market",
      code: "JIN-MAIN",
      location: "Jinja",
    },
  ] as const;

  const users = [
    {
      id: "user_vendor_amina",
      name: "Amina Nakato",
      email: "amina@email.com",
      phone: "+256700100200",
      password: "Vendor123!",
      role: "vendor",
      marketId: "market_kampala",
      mfaEnabled: 0,
      verified: createdAt,
      vendorStatus: "approved",
    },
    {
      id: "user_vendor_joseph",
      name: "Joseph Ochieng",
      email: "joseph@email.com",
      phone: "+256770200300",
      password: "Vendor123!",
      role: "vendor",
      marketId: "market_kampala",
      mfaEnabled: 0,
      verified: createdAt,
      vendorStatus: "pending",
    },
    {
      id: "user_vendor_grace",
      name: "Grace Auma",
      email: "grace@email.com",
      phone: "+256780300400",
      password: "Vendor123!",
      role: "vendor",
      marketId: "market_kampala",
      mfaEnabled: 0,
      verified: createdAt,
      vendorStatus: "approved",
    },
    {
      id: "user_vendor_paul",
      name: "Paul Ssenyonjo",
      email: "paul@email.com",
      phone: "+256701900100",
      password: "Vendor123!",
      role: "vendor",
      marketId: "market_kampala",
      mfaEnabled: 0,
      verified: createdAt,
      vendorStatus: "rejected",
    },
    {
      id: "user_vendor_mary",
      name: "Mary Nabirye",
      email: "mary@email.com",
      phone: "+256702800900",
      password: "Vendor123!",
      role: "vendor",
      marketId: "market_jinja",
      mfaEnabled: 0,
      verified: createdAt,
      vendorStatus: "approved",
    },
    {
      id: "user_manager_sarah",
      name: "Sarah Namutebi",
      email: "sarah@market.ug",
      phone: "+256700500600",
      password: "Manager123!",
      role: "manager",
      marketId: "market_kampala",
      mfaEnabled: 1,
      verified: createdAt,
      vendorStatus: null,
    },
    {
      id: "user_manager_brian",
      name: "Brian Waiswa",
      email: "brian@market.ug",
      phone: "+256703700800",
      password: "Manager123!",
      role: "manager",
      marketId: "market_jinja",
      mfaEnabled: 1,
      verified: createdAt,
      vendorStatus: null,
    },
    {
      id: "user_official_david",
      name: "David Lubega",
      email: "david@govt.ug",
      phone: "+256700600700",
      password: "Official123!",
      role: "official",
      marketId: null,
      mfaEnabled: 1,
      verified: createdAt,
      vendorStatus: null,
    },
    {
      id: "user_admin_ruth",
      name: "Ruth Nansubuga",
      email: "ruth.admin@mms.ug",
      phone: "+256701111222",
      password: "Admin123!",
      role: "admin",
      marketId: null,
      mfaEnabled: 1,
      verified: createdAt,
      vendorStatus: null,
    },
  ] as const;

  await transaction(async () => {
    markets.forEach((market) => {
    run(
      `INSERT OR IGNORE INTO markets (id, name, code, location, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [market.id, market.name, market.code, market.location, createdAt],
    );
  });

  const managerByMarket: Record<string, string> = {
    market_kampala: "user_manager_sarah",
    market_jinja: "user_manager_brian",
  };

  users.forEach((user) => {
    run(
      `INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, market_id, mfa_enabled, phone_verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.phone,
        hashPassword(user.password),
        user.role,
        user.marketId,
        user.mfaEnabled,
        user.verified,
        createdAt,
        createdAt,
      ],
    );

    if (user.marketId) {
      run(`UPDATE users SET market_id = ?, updated_at = ? WHERE id = ?`, [user.marketId, createdAt, user.id]);
    }
  });

  users.filter((user) => user.role === "vendor").forEach((user) => {
    const managerUserId = user.marketId ? managerByMarket[user.marketId] : null;
    run(
      `INSERT OR IGNORE INTO vendor_profiles (user_id, approval_status, approval_reason, id_document_name, id_document_path, id_document_mime_type, id_document_size, approved_by, approved_at, rejected_by, rejected_at)
       VALUES (?, ?, NULL, ?, ?, 'application/pdf', ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.vendorStatus,
        `${user.name.replace(/\s+/g, "_").toLowerCase()}_id.pdf`,
        path.join(config.uploadsDir, "seed", `${user.id}.pdf`),
        1024,
        user.vendorStatus === "approved" ? managerUserId : null,
        user.vendorStatus === "approved" ? createdAt : null,
        user.vendorStatus === "rejected" ? managerUserId : null,
        user.vendorStatus === "rejected" ? createdAt : null,
      ],
    );
  });

  const stalls = [
    ["stall_a01", "market_kampala", "A-01", "Zone A - Fresh Produce", "3x3m", 150000, "active", 1, "user_vendor_amina"],
    ["stall_a02", "market_kampala", "A-02", "Zone A - Fresh Produce", "3x3m", 150000, "inactive", 1, null],
    ["stall_b01", "market_kampala", "B-01", "Zone B - Dry Goods", "3x3m", 120000, "inactive", 1, null],
    ["stall_b02", "market_kampala", "B-02", "Zone B - Dry Goods", "3x3m", 120000, "inactive", 1, null],
    ["stall_c01", "market_kampala", "C-01", "Zone C - Clothing", "4x3m", 180000, "maintenance", 1, null],
    ["stall_d01", "market_kampala", "D-01", "Zone D - Electronics", "3x3m", 200000, "inactive", 1, null],
    ["stall_e02", "market_kampala", "E-02", "Zone E - Mixed Goods", "3x3m", 160000, "active", 1, "user_vendor_amina"],
    ["stall_j01", "market_jinja", "J-01", "Zone J - Textiles", "3x3m", 140000, "active", 1, "user_vendor_mary"],
    ["stall_j02", "market_jinja", "J-02", "Zone J - Dry Goods", "3x3m", 125000, "inactive", 1, null],
    ["stall_j03", "market_jinja", "J-03", "Zone J - Crafts", "4x3m", 155000, "maintenance", 1, null],
  ] as const;

  stalls.forEach((stall) => {
    run(
      `INSERT OR IGNORE INTO stalls (id, market_id, name, zone, size, price_per_month, status, is_published, assigned_vendor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...stall, createdAt, createdAt],
    );
    run(`UPDATE stalls SET market_id = COALESCE(market_id, ?), updated_at = ? WHERE id = ?`, [stall[1], createdAt, stall[0]]);
  });

  run(
    `INSERT OR IGNORE INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
     VALUES (?, 'market_kampala', ?, ?, 'paid', '2026-01-01', '2026-06-30', 900000, NULL, ?, ?, ?)` ,
    ["booking_amina_1", "stall_a01", "user_vendor_amina", createdAt, createdAt, createdAt],
  );
  run(
    `INSERT OR IGNORE INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
     VALUES (?, 'market_kampala', ?, ?, 'pending', '2026-03-01', '2026-03-31', 120000, NULL, ?, ?, NULL)`,
    ["booking_grace_1", "stall_b02", "user_vendor_grace", createdAt, createdAt],
  );
  run(
    `INSERT OR IGNORE INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
     VALUES (?, 'market_kampala', ?, ?, 'paid', ?, ?, 160000, NULL, ?, ?, ?)`,
    [
      "booking_expiring_1",
      "stall_e02",
      "user_vendor_amina",
      dateFromDayOffset(-28),
      dateFromDayOffset(1),
      isoFromDayOffset(-28),
      isoFromDayOffset(-1),
      isoFromDayOffset(-1),
    ],
  );
  run(
    `INSERT OR IGNORE INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
     VALUES (?, 'market_jinja', ?, ?, 'paid', ?, ?, 280000, NULL, ?, ?, ?)`,
    [
      "booking_mary_1",
      "stall_j01",
      "user_vendor_mary",
      dateFromDayOffset(-40),
      dateFromDayOffset(20),
      isoFromDayOffset(-40),
      isoFromDayOffset(-10),
      isoFromDayOffset(-10),
    ],
  );

  run(
    `INSERT OR IGNORE INTO payments (id, market_id, booking_id, vendor_id, provider, amount, status, transaction_id, external_reference, phone, receipt_id, receipt_message, created_at, updated_at, completed_at)
     VALUES (?, 'market_kampala', ?, ?, 'mtn', 150000, 'completed', 'MTN-2026-0001', 'EXT-0001', ?, 'RCPT-0001', ?, ?, ?, ?)`,
    [
      "payment_amina_1",
      "booking_amina_1",
      "user_vendor_amina",
      "+256700100200",
      "Payment of UGX 150,000 received. Transaction ID MTN-2026-0001.",
      createdAt,
      createdAt,
      createdAt,
    ],
  );
  run(
    `INSERT OR IGNORE INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
     VALUES (?, ?, 'mtn', 'completed', ?, ?)`,
    ["attempt_amina_1", "payment_amina_1", createdAt, createdAt],
  );

  [
    {
      id: "payment_amina_hist_1",
      bookingId: "booking_amina_1",
      amount: 150000,
      reference: "EXT-HIST-0001",
      transactionId: "MTN-HIST-0001",
      createdAt: isoFromMonthOffset(-5),
    },
    {
      id: "payment_amina_hist_2",
      bookingId: "booking_amina_1",
      amount: 150000,
      reference: "EXT-HIST-0002",
      transactionId: "MTN-HIST-0002",
      createdAt: isoFromMonthOffset(-4),
    },
    {
      id: "payment_amina_hist_3",
      bookingId: "booking_amina_1",
      amount: 150000,
      reference: "EXT-HIST-0003",
      transactionId: "MTN-HIST-0003",
      createdAt: isoFromMonthOffset(-3),
    },
    {
      id: "payment_amina_hist_4",
      bookingId: "booking_amina_1",
      amount: 150000,
      reference: "EXT-HIST-0004",
      transactionId: "MTN-HIST-0004",
      createdAt: isoFromMonthOffset(-2),
    },
    {
      id: "payment_amina_hist_5",
      bookingId: "booking_amina_1",
      amount: 150000,
      reference: "EXT-HIST-0005",
      transactionId: "MTN-HIST-0005",
      createdAt: isoFromMonthOffset(-1),
    },
    {
      id: "payment_expiring_1",
      bookingId: "booking_expiring_1",
      amount: 160000,
      reference: "EXT-EXPIRING-0001",
      transactionId: "AIRTEL-EXP-0001",
      createdAt: isoFromDayOffset(-2),
    },
  ].forEach((payment, index) => {
    run(
      `INSERT OR IGNORE INTO payments (id, market_id, booking_id, vendor_id, provider, amount, status, transaction_id, external_reference, phone, receipt_id, receipt_message, created_at, updated_at, completed_at)
       VALUES (?, 'market_kampala', ?, 'user_vendor_amina', ?, ?, 'completed', ?, ?, '+256700100200', ?, ?, ?, ?, ?)`,
      [
        payment.id,
        payment.bookingId,
        index === 5 ? "airtel" : "mtn",
        payment.amount,
        payment.transactionId,
        payment.reference,
        `RCPT-${payment.id.toUpperCase()}`,
        `Payment of UGX ${payment.amount.toLocaleString()} received. Transaction ID ${payment.transactionId}.`,
        payment.createdAt,
        payment.createdAt,
        payment.createdAt,
      ],
    );
    run(
      `INSERT OR IGNORE INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?)`,
      [payment.id.replace("payment", "attempt"), payment.id, index === 5 ? "airtel" : "mtn", payment.createdAt, payment.createdAt],
    );
  });

  [
    {
      id: "payment_mary_1",
      bookingId: "booking_mary_1",
      amount: 140000,
      reference: "EXT-MARY-0001",
      transactionId: "AIRTEL-MARY-0001",
      createdAt: isoFromMonthOffset(-1),
    },
    {
      id: "payment_mary_2",
      bookingId: "booking_mary_1",
      amount: 140000,
      reference: "EXT-MARY-0002",
      transactionId: "AIRTEL-MARY-0002",
      createdAt: isoFromDayOffset(-7),
    },
  ].forEach((payment) => {
    run(
      `INSERT OR IGNORE INTO payments (id, market_id, booking_id, vendor_id, provider, amount, status, transaction_id, external_reference, phone, receipt_id, receipt_message, created_at, updated_at, completed_at)
       VALUES (?, 'market_jinja', ?, 'user_vendor_mary', 'airtel', ?, 'completed', ?, ?, '+256702800900', ?, ?, ?, ?, ?)`,
      [
        payment.id,
        payment.bookingId,
        payment.amount,
        payment.transactionId,
        payment.reference,
        `RCPT-${payment.id.toUpperCase()}`,
        `Payment of UGX ${payment.amount.toLocaleString()} received. Transaction ID ${payment.transactionId}.`,
        payment.createdAt,
        payment.createdAt,
        payment.createdAt,
      ],
    );
    run(
      `INSERT OR IGNORE INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
       VALUES (?, ?, 'airtel', 'completed', ?, ?)`,
      [payment.id.replace("payment", "attempt"), payment.id, payment.createdAt, payment.createdAt],
    );
  });

  run(
    `INSERT OR IGNORE INTO payments (id, market_id, booking_id, vendor_id, provider, amount, status, transaction_id, external_reference, phone, receipt_id, receipt_message, created_at, updated_at, completed_at)
     VALUES (?, 'market_kampala', ?, 'user_vendor_grace', 'mtn', 120000, 'failed', 'MTN-FAILED-0001', 'EXT-GRACE-FAIL-0001', '+256780300400', NULL, 'Payment for B-02 failed. Reference MTN-FAILED-0001.', ?, ?, NULL)`,
    ["payment_grace_failed_1", "booking_grace_1", isoFromDayOffset(-3), isoFromDayOffset(-3)],
  );
  run(
    `INSERT OR IGNORE INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
     VALUES (?, ?, 'mtn', 'failed', ?, ?)`,
    ["attempt_grace_failed_1", "payment_grace_failed_1", isoFromDayOffset(-3), isoFromDayOffset(-3)],
  );

  run(
    `INSERT OR IGNORE INTO notifications (id, user_id, type, message, read_at, created_at)
     VALUES ('notif_seed_1', 'user_vendor_amina', 'payment', 'Payment of UGX 150,000 confirmed. Txn: MTN-2026-0001', NULL, ?)`,
    [createdAt],
  );
  run(
    `INSERT OR IGNORE INTO notifications (id, user_id, type, message, read_at, created_at)
     VALUES ('notif_seed_2', 'user_manager_sarah', 'system', 'New vendor registration: Joseph Ochieng awaiting approval.', NULL, ?)`,
    [createdAt],
  );
  run(
    `INSERT OR IGNORE INTO notifications (id, user_id, type, message, read_at, created_at)
     VALUES ('notif_seed_3', 'user_manager_brian', 'system', 'Mary Nabirye resolved her recent dues and remains in good standing.', NULL, ?)`,
    [createdAt],
  );

  run(
    `INSERT OR IGNORE INTO coordination_messages (id, sender_user_id, sender_name, sender_role, market_id, subject, body, created_at)
     VALUES ('coord_seed_1', 'user_official_david', 'David Lubega', 'official', 'market_kampala', 'Weekly oversight request', 'Please share the current occupancy and payment exception summary before Friday.', ?)`,
    [createdAt],
  );
  run(
    `INSERT OR IGNORE INTO coordination_messages (id, sender_user_id, sender_name, sender_role, market_id, subject, body, created_at)
     VALUES ('coord_seed_2', 'user_manager_sarah', 'Sarah Namutebi', 'manager', 'market_kampala', 'Operations update', 'Two stalls are under maintenance and one vendor approval is still pending review.', ?)`,
    [createdAt],
  );
  run(
    `INSERT OR IGNORE INTO coordination_messages (id, sender_user_id, sender_name, sender_role, market_id, subject, body, created_at)
     VALUES ('coord_seed_3', 'user_manager_brian', 'Brian Waiswa', 'manager', 'market_jinja', 'Jinja collections update', 'Collections are stable in Jinja, but one craft stall remains in maintenance pending timber replacement.', ?)`,
    [createdAt],
  );

  run(
    `INSERT OR IGNORE INTO tickets (id, market_id, vendor_id, category, subject, description, status, resolution_note, created_at, updated_at)
     VALUES (?, 'market_kampala', ?, 'maintenance', 'Leaking roof in stall A-01', 'The roof has been leaking since last week when it rains.', 'open', NULL, ?, ?)`,
    ["ticket_1", "user_vendor_amina", createdAt, createdAt],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'open', 'Ticket created by vendor.', ?)`,
    ["ticket_update_1", "ticket_1", "user_vendor_amina", createdAt],
  );

  run(
    `INSERT OR IGNORE INTO tickets (id, market_id, vendor_id, category, subject, description, status, resolution_note, created_at, updated_at)
     VALUES (?, 'market_kampala', ?, 'billing', 'Receipt mismatch on February payment', 'The receipt total did not match the cashier confirmation.', 'resolved', 'Cashier ledger reconciled and receipt reissued.', ?, ?)`,
    ["ticket_2", "user_vendor_amina", isoFromDayOffset(-18), isoFromDayOffset(-16)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'open', 'Ticket created by vendor.', ?)`,
    ["ticket_update_2a", "ticket_2", "user_vendor_amina", isoFromDayOffset(-18)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'resolved', 'Receipt reconciled and replacement issued.', ?)`,
    ["ticket_update_2b", "ticket_2", "user_manager_sarah", isoFromDayOffset(-16)],
  );
  run(
    `INSERT OR IGNORE INTO tickets (id, market_id, vendor_id, category, subject, description, status, resolution_note, created_at, updated_at)
     VALUES (?, 'market_kampala', ?, 'dispute', 'Neighboring stall blocked walkway', 'The neighboring stall extended its display into the shared path.', 'resolved', 'Manager issued a compliance warning and cleared the passage.', ?, ?)`,
    ["ticket_3", "user_vendor_grace", isoFromDayOffset(-9), isoFromDayOffset(-8)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'open', 'Ticket created by vendor.', ?)`,
    ["ticket_update_3a", "ticket_3", "user_vendor_grace", isoFromDayOffset(-9)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'resolved', 'Walkway restored and warning logged.', ?)`,
    ["ticket_update_3b", "ticket_3", "user_manager_sarah", isoFromDayOffset(-8)],
  );
  run(
    `INSERT OR IGNORE INTO tickets (id, market_id, vendor_id, category, subject, description, status, resolution_note, created_at, updated_at)
     VALUES (?, 'market_jinja', ?, 'maintenance', 'Water drainage near J-01', 'Drainage backs up after heavy rain and affects customer access near J-01.', 'resolved', 'Drainage trench cleared and gravel replaced.', ?, ?)`,
    ["ticket_4", "user_vendor_mary", isoFromDayOffset(-14), isoFromDayOffset(-12)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'open', 'Ticket created by vendor.', ?)`,
    ["ticket_update_4a", "ticket_4", "user_vendor_mary", isoFromDayOffset(-14)],
  );
  run(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
     VALUES (?, ?, ?, 'resolved', 'Drainage route cleared and monitored after inspection.', ?)`,
    ["ticket_update_4b", "ticket_4", "user_manager_brian", isoFromDayOffset(-12)],
  );

  [
    { id: "deposit_1", marketId: "market_kampala", reference: "BANK-DEP-001", amount: 150000, depositedAt: isoFromMonthOffset(-5) },
    { id: "deposit_2", marketId: "market_kampala", reference: "BANK-DEP-002", amount: 150000, depositedAt: isoFromMonthOffset(-4) },
    { id: "deposit_3", marketId: "market_kampala", reference: "BANK-DEP-003", amount: 150000, depositedAt: isoFromMonthOffset(-3) },
    { id: "deposit_4", marketId: "market_kampala", reference: "BANK-DEP-004", amount: 150000, depositedAt: isoFromMonthOffset(-2) },
    { id: "deposit_5", marketId: "market_kampala", reference: "BANK-DEP-005", amount: 140000, depositedAt: isoFromMonthOffset(-1) },
    { id: "deposit_6", marketId: "market_kampala", reference: "BANK-DEP-006", amount: 310000, depositedAt: isoFromDayOffset(-1) },
    { id: "deposit_7", marketId: "market_jinja", reference: "BANK-DEP-007", amount: 140000, depositedAt: isoFromMonthOffset(-1, 12) },
    { id: "deposit_8", marketId: "market_jinja", reference: "BANK-DEP-008", amount: 135000, depositedAt: isoFromDayOffset(-5) },
  ].forEach((deposit) => {
    run(
      `INSERT OR IGNORE INTO bank_deposits (id, market_id, reference, amount, deposited_at)
       VALUES (?, ?, ?, ?, ?)`,
      [deposit.id, deposit.marketId, deposit.reference, deposit.amount, deposit.depositedAt],
    );
  });

  run(
    `INSERT OR IGNORE INTO resource_requests (id, market_id, manager_user_id, manager_name, category, title, description, amount_requested, approved_amount, status, review_note, reviewed_by_user_id, reviewed_by_name, created_at, updated_at)
     VALUES (?, 'market_kampala', 'user_manager_sarah', 'Sarah Namutebi', 'budget', 'Drainage repairs before rainy week', 'Requesting funds to reinforce the drainage around Zone A before forecast rainfall.', 450000, NULL, 'pending', NULL, NULL, NULL, ?, ?)`,
    ["request_seed_1", isoFromDayOffset(-2), isoFromDayOffset(-2)],
  );
  run(
    `INSERT OR IGNORE INTO resource_requests (id, market_id, manager_user_id, manager_name, category, title, description, amount_requested, approved_amount, status, review_note, reviewed_by_user_id, reviewed_by_name, created_at, updated_at)
     VALUES (?, 'market_kampala', 'user_manager_sarah', 'Sarah Namutebi', 'structural', 'Electrical inspection for Zone D', 'Need a certified electrician to inspect repeated voltage spikes in the electronics section.', 600000, 500000, 'approved', 'Approved with phased procurement and safety reporting.', 'user_official_david', 'David Lubega', ?, ?)`,
    ["request_seed_2", isoFromDayOffset(-12), isoFromDayOffset(-10)],
  );
  run(
    `INSERT OR IGNORE INTO resource_requests (id, market_id, manager_user_id, manager_name, category, title, description, amount_requested, approved_amount, status, review_note, reviewed_by_user_id, reviewed_by_name, created_at, updated_at)
     VALUES (?, 'market_jinja', 'user_manager_brian', 'Brian Waiswa', 'structural', 'Flooring upgrade for textile lane', 'Requesting phased flooring reinforcement in the textile lane to improve drainage and reduce vendor accidents.', 520000, 480000, 'approved', 'Approved with staged rollout and monthly progress checks.', 'user_official_david', 'David Lubega', ?, ?)`,
    ["request_seed_3", isoFromDayOffset(-15), isoFromDayOffset(-13)],
  );

  run(
    `INSERT OR IGNORE INTO audit_events (id, actor_user_id, actor_name, actor_role, market_id, action, entity_type, entity_id, details_json, created_at)
     VALUES ('audit_seed_1', 'user_manager_sarah', 'Sarah Namutebi', 'manager', 'market_kampala', 'SEED_APPROVE_VENDOR', 'vendor', 'user_vendor_amina', ?, ?)`,
    [JSON.stringify({ note: "Initial seed approval" }), createdAt],
  );
  run(
    `INSERT OR IGNORE INTO audit_events (id, actor_user_id, actor_name, actor_role, market_id, action, entity_type, entity_id, details_json, created_at)
     VALUES ('audit_seed_2', 'user_manager_brian', 'Brian Waiswa', 'manager', 'market_jinja', 'SEED_RESOURCE_REQUEST', 'resource_request', 'request_seed_3', ?, ?)`,
    [JSON.stringify({ note: "Initial seeded Jinja capital request" }), createdAt],
  );

  run(`UPDATE users SET market_id = 'market_kampala', updated_at = ? WHERE market_id IS NULL AND role NOT IN ('official', 'admin')`, [createdAt]);
  run(`UPDATE stalls SET market_id = 'market_kampala', updated_at = ? WHERE market_id IS NULL`, [createdAt]);
  run(
    `UPDATE bookings
     SET market_id = (SELECT stalls.market_id FROM stalls WHERE stalls.id = bookings.stall_id)
     WHERE market_id IS NULL`,
  );
  run(
    `UPDATE payments
     SET market_id = (SELECT bookings.market_id FROM bookings WHERE bookings.id = payments.booking_id)
     WHERE market_id IS NULL`,
  );
  run(
    `UPDATE tickets
     SET market_id = (SELECT users.market_id FROM users WHERE users.id = tickets.vendor_id)
     WHERE market_id IS NULL`,
  );
  run(
    `UPDATE resource_requests
     SET market_id = COALESCE((SELECT users.market_id FROM users WHERE users.id = resource_requests.manager_user_id), 'market_kampala')
     WHERE market_id IS NULL`,
  );
  run(
    `UPDATE coordination_messages
     SET market_id = (SELECT users.market_id FROM users WHERE users.id = coordination_messages.sender_user_id)
     WHERE market_id IS NULL AND sender_role = 'manager'`,
  );
  run(`UPDATE coordination_messages SET market_id = 'market_kampala' WHERE id = 'coord_seed_1' AND market_id IS NULL`);
  run(`UPDATE bank_deposits SET market_id = 'market_kampala' WHERE market_id IS NULL`);
  run(
    `UPDATE audit_events
     SET market_id = (SELECT users.market_id FROM users WHERE users.id = audit_events.actor_user_id)
     WHERE market_id IS NULL AND actor_user_id IS NOT NULL`,
  );
  });

  if (config.supabaseAuthEnabled) {
    for (const user of users) {
      const linkedUser = await get<{ auth_user_id: string | null }>(`SELECT auth_user_id FROM users WHERE id = ?`, [user.id]);
      if (linkedUser?.auth_user_id) {
        continue;
      }

      const authUser = await syncSeedUserToSupabase({
        email: user.email,
        phone: user.phone,
        password: user.password,
        localUserId: user.id,
        name: user.name,
        role: user.role,
        marketId: user.marketId,
      });

      if (authUser) {
        await run(`UPDATE users SET auth_user_id = ?, updated_at = ? WHERE id = ?`, [authUser.id, nowIso(), user.id]);
      }
    }
  }
};
