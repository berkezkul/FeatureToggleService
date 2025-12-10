import { redis } from '../config/redis';
import { config } from '../config';
import { CacheOptions, CacheResult, CacheEntry, CacheMetadata } from '../types/cache';
import logger from '../config/logger';

/**
 * Cache Service for Redis-based caching
 * 
 * Features:
 * - TTL management
 * - Cache key patterns
 * - Cache invalidation (exact and pattern-based)
 * - ETag/versioning support
 * - Serialization/deserialization
 */
export class CacheService {
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;

  constructor() {
    this.defaultTTL = config.cache.ttl;
    this.keyPrefix = config.cache.prefix + ':';
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<CacheResult<T>> {
    const fullKey = this.getFullKey(key);

    try {
      const cached = await redis.get(fullKey);
      
      if (!cached) {
        return {
          hit: false,
          key: fullKey,
        };
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check if expired
      if (entry.metadata.expiresAt < Date.now()) {
        // Expired - delete and return miss
        await redis.del(fullKey);
        return {
          hit: false,
          key: fullKey,
        };
      }

      return {
        hit: true,
        data: entry.data,
        key: fullKey,
      };
    } catch (error) {
      logger.error('Cache get failed', {
        error,
        key: fullKey,
      });
      // On error, return miss (fail open)
      return {
        hit: false,
        key: fullKey,
      };
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const ttl = options.ttl || this.defaultTTL;

    try {
      const metadata: CacheMetadata = {
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttl * 1000,
        version: this.generateVersion(),
      };

      const entry: CacheEntry<T> = {
        data,
        metadata,
      };

      const serialized = JSON.stringify(entry);
      await redis.setex(fullKey, ttl, serialized);

      return true;
    } catch (error) {
      logger.error('Cache set failed', {
        error,
        key: fullKey,
      });
      // On error, return false but don't throw (fail open)
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const deleted = await redis.del(fullKey);
      return deleted > 0;
    } catch (error) {
      logger.error('Cache delete failed', {
        error,
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.getFullKey(pattern);

    try {
      // Use SCAN to find matching keys (safer than KEYS in production)
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100
        );
        cursor = result[0] as string;
        keys.push(...(result[1] as string[]));
      } while (cursor !== '0');

      if (keys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const deleted = await redis.del(...keys);
      return deleted;
    } catch (error) {
      logger.error('Cache delete pattern failed', {
        error,
        pattern: fullPattern,
      });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const exists = await redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists check failed', {
        error,
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Get cache metadata (for ETag support)
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    const fullKey = this.getFullKey(key);

    try {
      const cached = await redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const entry: CacheEntry<unknown> = JSON.parse(cached);
      return entry.metadata;
    } catch (error) {
      logger.error('Cache metadata get failed', {
        error,
        key: fullKey,
      });
      return null;
    }
  }

  /**
   * Invalidate cache for a tenant and environment
   */
  async invalidateTenantEnv(tenantId: string, env: string): Promise<number> {
    const pattern = `feature:${tenantId}:${env}:*`;
    return this.deletePattern(pattern);
  }

  /**
   * Invalidate cache for a specific feature flag
   */
  async invalidateFeatureFlag(
    tenantId: string,
    featureId: string,
    env: string
  ): Promise<boolean> {
    const key = this.getFeatureFlagKey(tenantId, featureId, env);
    return this.delete(key);
  }

  /**
   * Invalidate all cache for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    const pattern = `feature:${tenantId}:*`;
    return this.deletePattern(pattern);
  }

  /**
   * Generate cache key for feature flags list
   */
  getFeatureFlagsListKey(tenantId: string, env: string, page?: number, limit?: number): string {
    if (page && limit) {
      return `feature:${tenantId}:${env}:list:page:${page}:limit:${limit}`;
    }
    return `feature:${tenantId}:${env}:list`;
  }

  /**
   * Generate cache key for a specific feature flag
   */
  getFeatureFlagKey(tenantId: string, featureId: string, env: string): string {
    return `feature:${tenantId}:${featureId}:${env}`;
  }

  /**
   * Get full cache key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Generate cache version (for ETag support)
   */
  private generateVersion(): string {
    // Simple version based on timestamp and random
    // In production, you might want a more sophisticated versioning
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<number> {
    return this.deletePattern('*');
  }

  /**
   * Get cache statistics (for monitoring)
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage?: string;
  }> {
    try {
      // Get total keys with our prefix
      const pattern = `${this.keyPrefix}*`;
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0] as string;
        keys.push(...(result[1] as string[]));
      } while (cursor !== '0');

      return {
        totalKeys: keys.length,
      };
    } catch (error) {
      logger.error('Cache stats failed', { error });
      return {
        totalKeys: 0,
      };
    }
  }
}

