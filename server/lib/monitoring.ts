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

export const captureAuthFailure = (details: { userId?: string; phone?: string; reason: string; ip?: string }) => {
  logger.warn("Authentication failure", details);
  captureMessage("Authentication failure", {
    level: "warning",
    tags: { source: "auth", reason: details.reason },
    extra: details as unknown as Record<string, unknown>,
  });
};

export const captureDbConnectivityFailure = (error: Error, context?: Record<string, unknown>) => {
  logger.error("Database connectivity failure", error, context);
  captureException(error, {
    level: "error",
    tags: { source: "database" },
    extra: context,
  });
};

export const captureBackgroundJobFailure = (jobName: string, error: Error, metadata?: Record<string, unknown>) => {
  logger.error(`Background job failed: ${jobName}`, error, metadata);
  captureException(error, {
    level: "error",
    tags: { source: "background_job", job: jobName },
    extra: metadata,
  });
};

export const captureUncaughtException = (error: Error) => {
  logger.error("Uncaught exception", error);
  captureException(error, {
    level: "fatal",
    tags: { source: "uncaughtException" },
  });
};

export const captureUnhandledRejection = (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("Unhandled rejection", error);
  captureException(error, {
    level: "error",
    tags: { source: "unhandledRejection" },
  });
};

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
