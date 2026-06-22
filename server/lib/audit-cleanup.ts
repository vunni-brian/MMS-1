/**
 * @file Audit log cleanup routines.
 * Periodically deletes expired audit events in batches and records a final
 * cleanup event for traceability.
 */

import { config } from "../config.ts";
import { all, createId, run } from "./db.ts";
import { logger } from "./logger.ts";
import { nowIso } from "./security.ts";

const DEFAULT_RETENTION_DAYS = 365;
const BATCH_SIZE = 500;
const MAX_BATCHES_PER_RUN = 20;

/** Read `AUDIT_RETENTION_DAYS` from env or return the default (365). */
export const getAuditRetentionDays = (): number => {
  const envValue = process.env.AUDIT_RETENTION_DAYS?.trim();
  if (envValue) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_RETENTION_DAYS;
};

/** Read `AUDIT_CLEANUP_BATCH_SIZE` from env or return the default (500). */
export const getAuditCleanupBatchSize = (): number => {
  const envValue = process.env.AUDIT_CLEANUP_BATCH_SIZE?.trim();
  if (envValue) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 2000) {
      return parsed;
    }
  }
  return BATCH_SIZE;
};

/** Delete expired audit events in batches (up to 20 batches per run) and record a cleanup audit event. */
export const cleanupAuditLogs = async (): Promise<{
  deletedCount: number;
  batchesRun: number;
  retentionDays: number;
  durationMs: number;
}> => {
  const retentionDays = getAuditRetentionDays();
  const batchSize = getAuditCleanupBatchSize();
  const startTime = Date.now();

  let totalDeleted = 0;
  let batchesRun = 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffIso = cutoffDate.toISOString();

  logger.info("Audit log cleanup starting", {
    retentionDays,
    batchSize,
    cutoffDate: cutoffIso,
  });

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const rowsToDelete = await all<{ id: string }>(
      `SELECT id FROM audit_events WHERE created_at < ? LIMIT ?`,
      [cutoffIso, batchSize],
    );

    if (rowsToDelete.length === 0) {
      break;
    }

    const ids = rowsToDelete.map((row) => row.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const deleteResult = await run(
      `DELETE FROM audit_events WHERE id IN (${placeholders})`,
      ids,
    );

    totalDeleted += deleteResult.rowCount;
    batchesRun++;

    if (rowsToDelete.length < batchSize) {
      break;
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info("Audit log cleanup completed", {
    deletedCount: totalDeleted,
    batchesRun,
    retentionDays,
    durationMs,
  });

  await run(
    `INSERT INTO audit_events (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, NULL, 'system', 'admin', 'AUDIT_CLEANUP', 'system', ?, ?, ?)`,
    [
      createId("audit"),
      `cleanup_${nowIso().replace(/[:.]/g, "-")}`,
      JSON.stringify({
        deletedCount: totalDeleted,
        batchesRun,
        retentionDays,
        durationMs,
      }),
      nowIso(),
    ],
  );

  return {
    deletedCount: totalDeleted,
    batchesRun,
    retentionDays,
    durationMs,
  };
};
