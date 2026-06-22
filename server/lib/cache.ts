/**
 * @file In-memory cache layer.
 * Provides a simple TTL-based cache singleton and a decorator (cacheResponse)
 * for caching expensive function results.
 */

import { logger } from "./logger.ts";

/** Cache initialisation options. */
interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  prefix: string;
}

/** Internal wrapper that pairs a cached value with its expiration timestamp. */
interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

/** TTL-based in-memory cache with periodic cleanup. */
class InMemoryCache {
  private cache: Map<string, CacheItem<unknown>>;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: CacheConfig = { enabled: true, ttl: 300, prefix: "mms" }) {
    this.config = config;
    this.cache = new Map();
    
    // Cleanup expired items every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    
    logger.info("In-memory cache initialized", { enabled: config.enabled, ttl: config.ttl });
  }

  private cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Cache cleanup completed", { itemsRemoved: cleaned });
    }
  }

  private getKey(key: string): string {
    return `${this.config.prefix}:${key}`;
  }

  private isExpired(item: CacheItem<unknown>): boolean {
    return item.expiresAt < Date.now();
  }

  /** Retrieve a cached value, or `null` if missing / expired. */
  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    const fullKey = this.getKey(key);
    const item = this.cache.get(fullKey);

    if (!item) return null;
    if (this.isExpired(item)) {
      this.cache.delete(fullKey);
      return null;
    }

    logger.debug("Cache hit", { key });
    return item.value as T;
  }

  /** Store a value with optional custom TTL (seconds). */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;

    const fullKey = this.getKey(key);
    const expiresAt = Date.now() + ((ttl || this.config.ttl) * 1000);

    this.cache.set(fullKey, { value, expiresAt });
    logger.debug("Cache set", { key, ttl: ttl || this.config.ttl });
  }

  /** Remove a single key from the cache. */
  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
    logger.debug("Cache delete", { key });
  }

  /** Remove all entries. */
  async clear(): Promise<void> {
    this.cache.clear();
    logger.info("Cache cleared");
  }

  /** Check whether a key exists and is not yet expired. */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const fullKey = this.getKey(key);
    const item = this.cache.get(fullKey);

    if (!item) return false;
    if (this.isExpired(item)) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /** Return cached value or compute (via `factory`), cache, and return. */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /** Return diagnostic stats about the cache. */
  getStats() {
    return {
      size: this.cache.size,
      enabled: this.config.enabled,
      ttl: this.config.ttl,
      prefix: this.config.prefix,
    };
  }

  /** Stop cleanup timer and clear all entries. */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info("Cache destroyed");
  }
}

// Create singleton instance
let cacheInstance: InMemoryCache | null = null;

/** Initialise (or reinitialise) the global cache singleton. */
export const initCache = (config?: CacheConfig) => {
  if (cacheInstance) {
    cacheInstance.destroy();
  }
  cacheInstance = new InMemoryCache(config);
};

/** Return the global cache singleton (lazily created). */
export const getCache = (): InMemoryCache => {
  if (!cacheInstance) {
    cacheInstance = new InMemoryCache();
  }
  return cacheInstance;
};

/** Decorator that caches a method's return value by a key derived from its arguments. */
export const cacheResponse = <T>(
  key: string,
  ttl?: number
) => {
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getCache();
      const cacheKey = `${key}:${JSON.stringify(args)}`;

      const cached = await cache.get<T>(cacheKey);
      if (cached !== null) return cached;

      const result = await originalMethod.apply(this, args);
      await cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
};

/** Invalidate all cache keys matching a pattern (stub — logs only for in-memory impl). */
export const invalidatePattern = (pattern: string) => {
  const cache = getCache();
  const stats = cache.getStats();
  // For in-memory cache, we can iterate and delete matching keys
  // This is a simple implementation - for production, use a proper cache like Redis
  logger.info("Cache pattern invalidation", { pattern });
};

/** Invalidate all cache keys sharing a prefix (stub — logs only for in-memory impl). */
export const invalidateByPrefix = (prefix: string) => {
  const cache = getCache();
  const stats = cache.getStats();
  logger.info("Cache prefix invalidation", { prefix });
};

export default InMemoryCache;
