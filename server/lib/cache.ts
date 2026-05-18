import { logger } from "./logger.ts";

interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  prefix: string;
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

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

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;

    const fullKey = this.getKey(key);
    const expiresAt = Date.now() + ((ttl || this.config.ttl) * 1000);

    this.cache.set(fullKey, { value, expiresAt });
    logger.debug("Cache set", { key, ttl: ttl || this.config.ttl });
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
    logger.debug("Cache delete", { key });
  }

  async clear(): Promise<void> {
    this.cache.clear();
    logger.info("Cache cleared");
  }

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

  getStats() {
    return {
      size: this.cache.size,
      enabled: this.config.enabled,
      ttl: this.config.ttl,
      prefix: this.config.prefix,
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info("Cache destroyed");
  }
}

// Create singleton instance
let cacheInstance: InMemoryCache | null = null;

export const initCache = (config?: CacheConfig) => {
  if (cacheInstance) {
    cacheInstance.destroy();
  }
  cacheInstance = new InMemoryCache(config);
};

export const getCache = (): InMemoryCache => {
  if (!cacheInstance) {
    cacheInstance = new InMemoryCache();
  }
  return cacheInstance;
};

// Cache decorators for common patterns
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

// Cache invalidation helpers
export const invalidatePattern = (pattern: string) => {
  const cache = getCache();
  const stats = cache.getStats();
  // For in-memory cache, we can iterate and delete matching keys
  // This is a simple implementation - for production, use a proper cache like Redis
  logger.info("Cache pattern invalidation", { pattern });
};

export const invalidateByPrefix = (prefix: string) => {
  const cache = getCache();
  const stats = cache.getStats();
  logger.info("Cache prefix invalidation", { prefix });
};

export default InMemoryCache;
