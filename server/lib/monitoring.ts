/**
 * @file Monitoring / alerting helpers.
 * High-level wrapper around Sentry that also logs to the console. Provides
 * typed helpers for auth failures, DB connectivity issues, background-job
 * failures, and generic alerts.
 */

import { captureException, captureMessage } from "./sentry.ts";
import { logger } from "./logger.ts";

export type AlertSeverity = "critical" | "error" | "warning" | "info";

export interface AlertEvent {
  severity: AlertSeverity;
  source: string;
  message: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/** Log and report an authentication failure event. */
export const captureAuthFailure = (details: { userId?: string; phone?: string; reason: string; ip?: string }) => {
  logger.warn("Authentication failure", details);
  captureMessage("Authentication failure", {
    level: "warning",
    tags: { source: "auth", reason: details.reason },
    extra: details as unknown as Record<string, unknown>,
  });
};

/** Log and report a database-connectivity failure. */
export const captureDbConnectivityFailure = (error: Error, context?: Record<string, unknown>) => {
  logger.error("Database connectivity failure", error, context);
  captureException(error, {
    level: "error",
    tags: { source: "database" },
    extra: context,
  });
};

/** Log and report a background-job failure. */
export const captureBackgroundJobFailure = (jobName: string, error: Error, metadata?: Record<string, unknown>) => {
  logger.error(`Background job failed: ${jobName}`, error, metadata);
  captureException(error, {
    level: "error",
    tags: { source: "background_job", job: jobName },
    extra: metadata,
  });
};

/** Log and report an uncaught exception (fatal severity). */
export const captureUncaughtException = (error: Error) => {
  logger.error("Uncaught exception", error);
  captureException(error, {
    level: "fatal",
    tags: { source: "uncaughtException" },
  });
};

/** Log and report an unhandled promise rejection. */
export const captureUnhandledRejection = (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("Unhandled rejection", error);
  captureException(error, {
    level: "error",
    tags: { source: "unhandledRejection" },
  });
};

/** Log and optionally send a Sentry event for a generic alert. */
export const reportAlert = (event: AlertEvent) => {
  const logMethod = event.severity === "critical" || event.severity === "error" ? "error" : event.severity === "warning" ? "warn" : "info";
  logger[logMethod](event.message, event.metadata);

  if (event.error) {
    captureException(event.error, {
      level: event.severity === "critical" ? "fatal" : event.severity as "error" | "warning",
      tags: { source: event.source },
      extra: event.metadata,
    });
  } else {
    captureMessage(event.message, {
      level: event.severity === "critical" ? "fatal" : event.severity as "error" | "warning" | "info",
      tags: { source: event.source },
      extra: event.metadata,
    });
  }
};
