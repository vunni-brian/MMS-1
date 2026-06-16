import type { IncomingMessage } from "node:http";

interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

interface Logger {
  info: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
  child: (context: LogContext) => Logger;
}

class PinoLikeLogger implements Logger {
  private context: LogContext;
  private level: string;

  constructor(context: LogContext = {}, level: string = "info") {
    this.context = context;
    this.level = level;
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: string, message: string, additionalContext: LogContext = {}): string {
    const timestamp = new Date().toISOString();
    const allContext = { ...this.context, ...additionalContext };
    const contextStr = Object.keys(allContext).length > 0 ? JSON.stringify(allContext) : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`;
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    if (this.shouldLog("error")) {
      const errorContext = error ? { 
        error: error.message, 
        stack: error.stack 
      } : {};
      console.error(this.formatMessage("error", message, { ...context, ...errorContext }));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  child(context: LogContext): Logger {
    return new PinoLikeLogger({ ...this.context, ...context }, this.level);
  }
}

// Create a default logger instance
const defaultLogger = new PinoLikeLogger({}, process.env.LOG_LEVEL || "info");

// Helper to extract request context
export const extractRequestContext = (req: IncomingMessage): LogContext => {
  const forwarded = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const remoteAddress = req.socket.remoteAddress;

  return {
    ip: (forwarded as string)?.split(",")[0].trim() || (realIp as string) || remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    method: req.method,
    path: req.url,
  };
};

// Export the logger and helper functions
export const logger = defaultLogger;

export const createLogger = (context: LogContext = {}): Logger => {
  return defaultLogger.child(context);
};

export const setLogLevel = (level: string) => {
  const newLogger = new PinoLikeLogger({}, level);
  Object.assign(defaultLogger, newLogger);
};

// Enable JSON log output by setting MMS_JSON_LOG=true
const useJsonLog = process.env.MMS_JSON_LOG === "true" || process.env.NODE_ENV === "production";

if (useJsonLog) {
  const jsonLogger: Logger = {
    info: (message: string, context?: LogContext) => {
      if (defaultLogger["level"] !== "debug" && defaultLogger["level"] !== "info") return;
      console.log(JSON.stringify({ level: "info", msg: message, time: new Date().toISOString(), ...context }));
    },
    error: (message: string, error?: Error, context?: LogContext) => {
      console.error(JSON.stringify({
        level: "error", msg: message, time: new Date().toISOString(),
        error: error ? { message: error.message, stack: error.stack } : undefined,
        ...context,
      }));
    },
    warn: (message: string, context?: LogContext) => {
      console.warn(JSON.stringify({ level: "warn", msg: message, time: new Date().toISOString(), ...context }));
    },
    debug: (message: string, context?: LogContext) => {
      if (defaultLogger["level"] !== "debug") return;
      console.debug(JSON.stringify({ level: "debug", msg: message, time: new Date().toISOString(), ...context }));
    },
    child: () => jsonLogger,
  };
  Object.assign(defaultLogger, jsonLogger);
}
