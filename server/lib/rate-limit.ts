import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "./http.ts";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  requests: Map<string, number[]>;
  cleanupInterval: NodeJS.Timeout;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

class RateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.config = config;
    this.store = {
      requests: new Map(),
      cleanupInterval: setInterval(() => this.cleanup(), this.config.windowMs),
    };
  }

  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    for (const [key, timestamps] of this.store.requests.entries()) {
      const validTimestamps = timestamps.filter((ts) => ts > cutoff);
      if (validTimestamps.length === 0) {
        this.store.requests.delete(key);
      } else {
        this.store.requests.set(key, validTimestamps);
      }
    }
  }

  private getClientIdentifier(req: IncomingMessage): string {
    // Try to get IP from various headers (proxy-aware)
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const remoteAddress = req.socket.remoteAddress;

    const ip = (forwarded as string)?.split(",")[0].trim() ||
               (realIp as string) ||
               remoteAddress ||
               "unknown";

    return ip;
  }

  private checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const timestamps = this.store.requests.get(identifier) || [];

    // Filter out old timestamps
    const validTimestamps = timestamps.filter((ts) => ts > cutoff);

    if (validTimestamps.length >= this.config.maxRequests) {
      // Find when the oldest request will expire
      const oldestTimestamp = validTimestamps[0];
      const resetTime = oldestTimestamp + this.config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.store.requests.set(identifier, validTimestamps);

    return {
      allowed: true,
      remaining: this.config.maxRequests - validTimestamps.length,
      resetTime: now + this.config.windowMs,
    };
  }

  middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const identifier = this.getClientIdentifier(req);
    const result = this.checkRateLimit(identifier);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", this.config.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      throw new HttpError(429, "Too many requests. Please try again later.");
    }

    next();
  }

  destroy() {
    clearInterval(this.store.cleanupInterval);
    this.store.requests.clear();
  }
}

const envWindow = (key: string, def: number) => {
  const val = process.env[key];
  return val ? Number(val) * 60 * 1000 : def;
};

const envMax = (key: string, def: number) => {
  const val = process.env[key];
  return val ? Number(val) : def;
};

// Create singleton instances for different rate limit strategies
const globalRateLimiter = new RateLimiter({
  windowMs: envWindow("RATE_LIMIT_GLOBAL_WINDOW_MINUTES", 15),
  maxRequests: envMax("RATE_LIMIT_GLOBAL_MAX", 100),
});

const authRateLimiter = new RateLimiter({
  windowMs: envWindow("RATE_LIMIT_AUTH_WINDOW_MINUTES", 15),
  maxRequests: envMax("RATE_LIMIT_AUTH_MAX", 5),
});

const apiRateLimiter = new RateLimiter({
  windowMs: envWindow("RATE_LIMIT_API_WINDOW_MINUTES", 1),
  maxRequests: envMax("RATE_LIMIT_API_MAX", 30),
});

export const rateLimitMiddleware = (strategy: "global" | "auth" | "api" = "global") => {
  const limiter = strategy === "auth" ? authRateLimiter : strategy === "api" ? apiRateLimiter : globalRateLimiter;
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    limiter.middleware(req, res, next);
  };
};

export const destroyRateLimiters = () => {
  globalRateLimiter.destroy();
  authRateLimiter.destroy();
  apiRateLimiter.destroy();
};
