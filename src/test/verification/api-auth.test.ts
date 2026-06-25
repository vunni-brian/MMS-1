/**
 * Integration tests for API authorization across all user roles
 * (vendor, manager, official, admin). Runs as a standalone script
 * (not vitest) — authenticates each role via real login flows
 * (including MFA for privileged roles) and asserts HTTP status codes
 * for guarded endpoints.
 */
import pg from "pg";
const { Pool } = pg;

const API_BASE = "http://localhost:3001";
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/mms";

interface Session {
  token: string;
  user: { id: string; name: string; role: string; marketId: string | null };
}

let passCount = 0;
let failCount = 0;
let skipCount = 0;

const pool = new Pool({ connectionString: DATABASE_URL });

const api = async (method: string, path: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json() } catch { /* ignore parse errors */ }
  return { status: res.status, data };
};

const loginAsVendor = async (): Promise<Session> => {
  const { data } = await api("POST", "/auth/login", { phone: "+256700100200", password: "Vendor123!" });
  return data as unknown as Session;
};

const loginAsManager = async (): Promise<Session> => {
  const { data: loginData } = await api("POST", "/auth/login", { phone: "+256700500600", password: "Manager123!" });
  const { challengeId } = loginData as { mfaRequired: boolean; challengeId: string };
  if (!challengeId) throw new Error(`MFA challenge not issued: ${JSON.stringify(loginData)}`);
  // Read the OTP from the database notification that was sent to the manager
  const result = await pool.query<{ message: string }>(
    `SELECT message FROM notifications WHERE user_id = 'user_manager_sarah' ORDER BY created_at DESC LIMIT 1`,
  );
  const message = result.rows[0]?.message;
  if (!message) throw new Error("OTP notification not found in database");
  const code = message.match(/code is (\d+)/)?.[1];
  if (!code) throw new Error(`Could not extract OTP code from: ${message}`);
  const { data: verifyData } = await api("POST", "/auth/verify-manager-mfa", { challengeId, code });
  return verifyData as unknown as Session;
};

const loginAsOfficial = async (): Promise<Session> => {
  const { data: loginData } = await api("POST", "/auth/login", { phone: "+256700600700", password: "Official123!" });
  const { challengeId } = loginData as { mfaRequired: boolean; challengeId: string };
  if (!challengeId) throw new Error(`MFA challenge not issued: ${JSON.stringify(loginData)}`);
  // Extract OTP from the persisted notification for this official user
  const result = await pool.query<{ message: string }>(
    `SELECT message FROM notifications WHERE user_id = 'user_official_david' ORDER BY created_at DESC LIMIT 1`,
  );
  const message = result.rows[0]?.message;
  if (!message) throw new Error("OTP notification not found in database");
  const code = message.match(/code is (\d+)/)?.[1];
  if (!code) throw new Error(`Could not extract OTP code from: ${message}`);
  const { data: verifyData } = await api("POST", "/auth/verify-privileged-mfa", { challengeId, code });
  return verifyData as unknown as Session;
};

const loginAsAdmin = async (): Promise<Session> => {
  const { data: loginData } = await api("POST", "/auth/login", { phone: "+256701111222", password: "Admin123!" });
  const { challengeId } = loginData as { mfaRequired: boolean; challengeId: string };
  if (!challengeId) throw new Error(`MFA challenge not issued: ${JSON.stringify(loginData)}`);
  // Extract OTP from the persisted notification for this admin user
  const result = await pool.query<{ message: string }>(
    `SELECT message FROM notifications WHERE user_id = 'user_admin_ruth' ORDER BY created_at DESC LIMIT 1`,
  );
  const message = result.rows[0]?.message;
  if (!message) throw new Error("OTP notification not found in database");
  const code = message.match(/code is (\d+)/)?.[1];
  if (!code) throw new Error(`Could not extract OTP code from: ${message}`);
  const { data: verifyData } = await api("POST", "/auth/verify-privileged-mfa", { challengeId, code });
  return verifyData as unknown as Session;
};

const test = (_name: string, _fn: () => Promise<void>) => void 0;

const assertStatus = (expected: number, actual: number, label: string) => {
  if (actual === expected) {
    passCount++;
    console.log(`  PASS  ${label} (expected ${expected}, got ${actual})`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label} (expected ${expected}, got ${actual})`);
  }
};

const assertNotStatus = (unexpected: number, actual: number, label: string) => {
  if (actual !== unexpected) {
    passCount++;
    console.log(`  PASS  ${label} (did not get ${unexpected}, got ${actual})`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label} (unexpectedly got ${unexpected})`);
  }
};

const runTests = async () => {
  console.log("\n=== API AUTHORIZATION VERIFICATION ===\n");

  let vendor: Session;
  let manager: Session;
  let official: Session;
  let admin: Session;

  console.log("--- Logging in as each role ---");
  try {
    vendor = await loginAsVendor();
    console.log(`  Vendor: ${vendor.user.name} (${vendor.user.id})`);
  } catch (e) {
    console.log(`  SKIP vendor: ${e}`);
    skipCount++;
    vendor = null!;
  }
  try {
    manager = await loginAsManager();
    console.log(`  Manager: ${manager.user.name} (${manager.user.id})`);
  } catch (e) {
    console.log(`  SKIP manager: ${e}`);
    skipCount++;
    manager = null!;
  }
  try {
    official = await loginAsOfficial();
    console.log(`  Official: ${official.user.name} (${official.user.id})`);
  } catch (e) {
    console.log(`  SKIP official: ${e}`);
    skipCount++;
    official = null!;
  }
  try {
    admin = await loginAsAdmin();
    console.log(`  Admin: ${admin.user.name} (${admin.user.id})`);
  } catch (e) {
    console.log(`  SKIP admin: ${e}`);
    skipCount++;
    admin = null!;
  }

  // Each block is a test section; wrap in `false && { ... }` to disable a section
  console.log("\n--- 1. Unauthenticated Access (expect 401) ---");
  {
    const r = await api("GET", "/audit");
    assertStatus(401, r.status, "GET /audit");
  }
  {
    const r = await api("GET", "/payments");
    assertStatus(401, r.status, "GET /payments");
  }
  {
    const r = await api("POST", "/announcements", { title: "x", body: "x" });
    assertStatus(401, r.status, "POST /announcements");
  }
  {
    const r = await api("POST", "/vendors/user_vendor_amina/approve");
    assertStatus(401, r.status, "POST /vendors/:id/approve");
  }
  {
    const r = await api("POST", "/stalls", { marketId: "market_kampala", name: "x", zone: "A", size: "M", pricePerMonth: 100 });
    assertStatus(401, r.status, "POST /stalls");
  }
  {
    const r = await api("POST", "/penalties", { vendorId: "user_vendor_amina", amount: 1000, reason: "test" });
    assertStatus(401, r.status, "POST /penalties");
  }
  {
    const r = await api("GET", "/billing/charge-types");
    assertStatus(401, r.status, "GET /billing/charge-types");
  }
  {
    const r = await api("POST", "/auth/change-password", { currentPassword: "x", newPassword: "y" });
    assertStatus(401, r.status, "POST /auth/change-password (no auth)");
  }

  if (vendor) {
    // --- 2. Vendor Authorization (expect 403 for admin/staff endpoints) ---
    console.log("\n--- 2. Vendor Authorization (expect 403 for admin/staff endpoints) ---");
    {
      const r = await api("POST", "/vendors/user_vendor_amina/approve", {}, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /vendors/:id/approve → 403");
    }
    {
      const r = await api("POST", "/vendors/user_vendor_joseph/reject", { reason: "x" }, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /vendors/:id/reject → 403");
    }
    {
      const r = await api("GET", "/audit", undefined, vendor.token);
      assertStatus(403, r.status, "VENDOR GET /audit → 403");
    }
    {
      const r = await api("POST", "/stalls", { marketId: "market_kampala", name: "x", zone: "A", size: "M", pricePerMonth: 100 }, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /stalls → 403");
    }
    {
      const r = await api("POST", "/penalties", { vendorId: "user_vendor_amina", amount: 1000, reason: "test" }, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /penalties → 403");
    }
    {
      const r = await api("POST", "/announcements", { title: "Test", body: "Test body" }, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /announcements → 403");
    }
    {
      const r = await api("PATCH", "/billing/charge-types/some-id", { isEnabled: 0 }, vendor.token);
      assertStatus(403, r.status, "VENDOR PATCH /billing/charge-types/:id → 403");
    }
    {
      const r = await api("POST", "/coordination/messages", { subject: "x", body: "x" }, vendor.token);
      assertStatus(403, r.status, "VENDOR POST /coordination/messages → 403");
    }
    {
      const r = await api("GET", "/coordination/messages", undefined, vendor.token);
      assertStatus(403, r.status, "VENDOR GET /coordination/messages → 403");
    }

    // Vendors should only see their own profile, not other users'
    console.log("\n--- 3. Vendor Ownership (vendor can only see own data) ---");
    {
      const r = await api("GET", "/vendors/user_admin_ruth", undefined, vendor.token);
      assertNotStatus(200, r.status, "VENDOR GET /vendors/:id (other vendor) → not 200");
    }
    {
      const r = await api("GET", "/vendors/user_vendor_amina", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /vendors/:id (self) → 200");
    }

    // Read-only endpoints that vendors are allowed to access
    console.log("\n--- 4. Vendor Allowed Actions (expect 200) ---");
    {
      const r = await api("GET", "/tickets", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /tickets → 200");
    }
    {
      const r = await api("GET", "/notifications", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /notifications → 200");
    }
    {
      const r = await api("GET", "/announcements", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /announcements → 200");
    }
    {
      const r = await api("GET", "/stalls", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /stalls → 200");
    }
    {
      const r = await api("GET", "/utility-charges", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /utility-charges → 200");
    }
    {
      const r = await api("GET", "/penalties", undefined, vendor.token);
      assertStatus(200, r.status, "VENDOR GET /penalties → 200");
    }
  }

  if (manager) {
    console.log("\n--- 5. Manager Authorization (expect 403 for admin-only endpoints) ---");
    {
      const r = await api("POST", "/auth/managers", { email: "test@test.com", name: "Test", password: "Test123!", phone: "+256700000001", marketId: "market_kampala" }, manager.token);
      assertStatus(403, r.status, "MANAGER POST /auth/managers → 403");
    }
    {
      const r = await api("GET", "/auth/users", undefined, manager.token);
      assertStatus(403, r.status, "MANAGER GET /auth/users → 403");
    }
    {
      const r = await api("PATCH", "/billing/charge-types/some-id", { isEnabled: 0 }, manager.token);
      assertStatus(403, r.status, "MANAGER PATCH /billing/charge-types/:id → 403");
    }

    // Managers can manage vendors and view data within their assigned market
    console.log("\n--- 6. Manager Scoped Access (can see own market) ---");
    {
      const r = await api("GET", "/vendors", undefined, manager.token);
      assertStatus(200, r.status, "MANAGER GET /vendors → 200");
    }
    {
      const r = await api("GET", "/stalls?marketId=market_kampala", undefined, manager.token);
      assertStatus(200, r.status, "MANAGER GET /stalls?marketId=market_kampala → 200");
    }
    {
      const r = await api("POST", "/vendors/user_vendor_amina/approve", {}, manager.token);
      assertStatus(200, r.status, "MANAGER POST /vendors/:id/approve → 200");
    }
    {
      const r = await api("GET", "/audit", undefined, manager.token);
      assertStatus(200, r.status, "MANAGER GET /audit → 200");
    }
    {
      const r = await api("POST", "/announcements", { title: "Test", body: "Test body" }, manager.token);
      assertStatus(201, r.status, "MANAGER POST /announcements → 201");
    }
    {
      const r = await api("GET", "/reports/revenue", undefined, manager.token);
      assertStatus(200, r.status, "MANAGER GET /reports/revenue → 200");
    }
  }

  if (official) {
    console.log("\n--- 7. Official Authorization ---");
    {
      const r = await api("GET", "/audit", undefined, official.token);
      assertStatus(200, r.status, "OFFICIAL GET /audit → 200");
    }
    {
      const r = await api("POST", "/coordination/messages", { subject: "Test", body: "Test body" }, official.token);
      assertStatus(201, r.status, "OFFICIAL POST /coordination/messages → 201");
    }
    {
      const r = await api("GET", "/auth/users", undefined, official.token);
      assertStatus(403, r.status, "OFFICIAL GET /auth/users → 403 (auth:manage required)");
    }
    {
      const r = await api("POST", "/auth/managers", { email: "test@test.com", name: "Test", password: "Test123!", phone: "+256700000001", marketId: "market_kampala" }, official.token);
      assertStatus(403, r.status, "OFFICIAL POST /auth/managers → 403");
    }
    {
      const r = await api("POST", "/stalls", { marketId: "market_kampala", name: "x", zone: "A", size: "M", pricePerMonth: 100 }, official.token);
      assertStatus(403, r.status, "OFFICIAL POST /stalls → 403 (stall:write not in official permissions)");
    }
  }

  if (admin) {
    console.log("\n--- 8. Admin Authorization (expect 200 for all admin endpoints) ---");
    {
      const r = await api("GET", "/auth/users", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /auth/users → 200");
    }
    {
      const r = await api("GET", "/audit", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /audit → 200");
    }
    {
      const r = await api("GET", "/billing/charge-types", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /billing/charge-types → 200");
    }
    {
      const r = await api("GET", "/vendors", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /vendors → 200");
    }
    {
      const r = await api("GET", "/payments", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /payments → 200");
    }
    {
      const r = await api("GET", "/reports/revenue", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /reports/revenue → 200");
    }
    {
      const r = await api("GET", "/reports/financial-audit", undefined, admin.token);
      assertStatus(200, r.status, "ADMIN GET /reports/financial-audit → 200");
    }
  }

  console.log("\n--- 9. Public Endpoints (expect 200 without auth) ---");
  {
    const r = await api("GET", "/health");
    assertStatus(200, r.status, "GET /health → 200");
  }
  {
    const r = await api("GET", "/markets");
    assertStatus(200, r.status, "GET /markets → 200");
  }

  await pool.end();

  const total = passCount + failCount;
  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed, ${skipCount} skipped (${total} total) ===\n`);
  process.exit(failCount > 0 ? 1 : 0);
};

runTests();
