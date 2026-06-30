/**
 * Audits manual receipt payments stuck in `pending` status because the
 * verify endpoint was unreachable by any role (permission bug in
 * `POST /payments/:id/verify`).
 *
 * Run before deploying the fix to assess the backlog:
 *   deno task run scripts/audit-stuck-receipts.ts
 *
 * Returns a summary + full list of stuck receipts that need manual triage.
 */
import { db } from "../server/lib/db.ts";

const rows = await db.query<{
  id: string;
  vendor_id: string;
  amount: number;
  created_at: string;
  receipt_file_name: string | null;
  receipt_id: string | null;
}>(
  `SELECT id, vendor_id, amount, created_at, receipt_file_name, receipt_id
   FROM payments
   WHERE provider = 'receipt' AND status = 'pending'
   ORDER BY created_at DESC`,
);

console.log("=== Stuck Receipt Audit ===");
console.log(`Count: ${rows.length}`);

if (rows.length > 0) {
  const oldest = rows[rows.length - 1].created_at;
  const newest = rows[0].created_at;
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`Total amount: ${total}`);
  console.log(`Date range: ${oldest} → ${newest}`);
  console.log();
  console.log("ID|Vendor|Amount|Created|File");
  for (const r of rows) {
    console.log(`${r.id}|${r.vendor_id}|${r.amount}|${r.created_at}|${r.receipt_file_name ?? ""}`);
  }
}

await db.end();
