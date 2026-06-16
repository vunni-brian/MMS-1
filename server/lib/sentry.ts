import crypto from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";

interface SentryConfig {
  dsn: string;
  environment: string;
  release: string;
  enabled: boolean;
  sampleRate: number;
  tracesSampleRate: number;
}

interface SentryContext {
  user?: {
    id: string;
    email?: string;
    username?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
}

class SentryClient {
  private config: SentryConfig;
  private enabled: boolean;

  constructor(config: SentryConfig) {
    this.config = config;
    this.enabled = config.enabled && !!config.dsn;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private shouldTrace(): boolean {
    return Math.random() < this.config.tracesSampleRate;
  }

  captureException(error: Error, context: SentryContext = {}) {
    if (!this.enabled || !this.shouldSample()) return;

    const event = {
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: this.parseStackTrace(error.stack),
          },
        ],
      },
      context: {
        user: context.user,
        tags: {
          environment: this.config.environment,
          release: this.config.release,
          ...context.tags,
        },
        extra: context.extra,
      },
      level: context.level || "error",
      timestamp: Date.now() / 1000,
    };

    this.sendEvent(event);
  }

  captureMessage(message: string, context: SentryContext = {}) {
    if (!this.enabled || !this.shouldSample()) return;

    const event = {
      message,
      context: {
        user: context.user,
        tags: {
          environment: this.config.environment,
          release: this.config.release,
          ...context.tags,
        },
        extra: context.extra,
      },
      level: context.level || "info",
      timestamp: Date.now() / 1000,
    };

    this.sendEvent(event);
  }

  private parseStackTrace(stack?: string) {
    if (!stack) return undefined;

    const frames = stack.split("\n").slice(1).map((line) => {
      const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/) ||
                   line.match(/at (.+):(\d+):(\d+)/);
      
      if (match) {
        return {
          filename: match[2] || "unknown",
          function: match[1] || "anonymous",
          lineno: parseInt(match[3] || "0", 10),
          colno: parseInt(match[4] || "0", 10),
        };
      }
      return { filename: "unknown", function: "anonymous", lineno: 0, colno: 0 };
    });

    return { frames };
  }

  private parseDsn(): { host: string; projectId: string; publicKey: string; secretKey: string } | null {
    try {
      const url = new URL(this.config.dsn);
      const [publicKey, secretKey] = (url.username || "").split(":");
      return {
        host: url.hostname,
        projectId: url.pathname.replace(/^\//, ""),
        publicKey,
        secretKey: secretKey || "",
      };
    } catch {
      return null;
    }
  }

  private sendEvent(event: unknown) {
    const parsed = this.parseDsn();
    if (!parsed) {
      console.error("[Sentry] Invalid DSN, cannot send event");
      return;
    }

    const body = JSON.stringify({
      event_id: crypto.randomUUID().replace(/-/g, ""),
      sent_at: new Date().toISOString(),
      ...(event as Record<string, unknown>),
    });

    const isHttps = this.config.dsn.startsWith("https");
    const requester = isHttps ? httpsRequest : httpRequest;

    const req = requester(
      {
        hostname: parsed.host,
        port: isHttps ? 443 : 80,
        path: `/api/${parsed.projectId}/store/`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=mmSentry/1.0.0, sentry_key=${parsed.publicKey}`,
        },
        timeout: 5_000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error(`[Sentry] API returned ${res.statusCode}`);
        }
        res.resume();
      },
    );

    req.on("error", (err) => {
      console.error("[Sentry] Failed to send event:", err.message);
    });

    req.on("timeout", () => {
      req.destroy();
      console.error("[Sentry] Request timed out");
    });

    req.write(body);
    req.end();
  }

  setUser(user: SentryContext["user"]) {
    if (this.enabled) {
      console.debug("[Sentry] User context set:", user?.id);
    }
  }

  clearUser() {
    if (this.enabled) {
      console.debug("[Sentry] User context cleared");
    }
  }

  addBreadcrumb(message: string, category: string = "default", level: string = "info") {
    if (!this.enabled) return;
    console.debug("[Sentry] Breadcrumb:", { message, category, level });
  }
}

// Create singleton instance
let sentryClient: SentryClient | null = null;

export const initSentry = (config: SentryConfig) => {
  sentryClient = new SentryClient(config);
  console.log(`Sentry ${config.enabled ? "enabled" : "disabled"} for environment: ${config.environment}`);
};

export const getSentry = () => {
  if (!sentryClient) {
    throw new Error("Sentry not initialized. Call initSentry() first.");
  }
  return sentryClient;
};

export const captureException = (error: Error, context?: SentryContext) => {
  try {
    getSentry().captureException(error, context);
  } catch (e) {
    // Fail silently if Sentry is not initialized
    console.error("Failed to capture exception:", e);
  }
};

export const captureMessage = (message: string, context?: SentryContext) => {
  try {
    getSentry().captureMessage(message, context);
  } catch (e) {
    // Fail silently if Sentry is not initialized
    console.error("Failed to capture message:", e);
  }
};

export const setSentryUser = (user: SentryContext["user"]) => {
  try {
    getSentry().setUser(user);
  } catch (e) {
    // Fail silently if Sentry is not initialized
  }
};

export const clearSentryUser = () => {
  try {
    getSentry().clearUser();
  } catch (e) {
    // Fail silently if Sentry is not initialized
  }
};

// Helper to extract user context from request
export const extractSentryUserFromRequest = (req: IncomingMessage, userId?: string) => {
  return {
    id: userId || "anonymous",
    ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
               (req.headers["x-real-ip"] as string) ||
               req.socket.remoteAddress,
    user_agent: req.headers["user-agent"],
  };
};
