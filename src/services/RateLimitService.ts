import { redis } from '../config/redis';
import { config } from '../config';
import { RateLimitConfig, RateLimitResult, RateLimitInfo } from '../types/rateLimit';
import logger from '../config/logger';

/**
 * Rate Limiting Service using Token Bucket Algorithm
 * 
 * Implements both burst and sustained rate limiting:
 * - Sustained: Long-term average rate (e.g., 100 requests per 15 minutes)
 * - Burst: Short-term spike allowance (e.g., 20 additional requests)
 * 
 * Uses Redis for distributed rate limiting across multiple instances
 */
export class RateLimitService {
  private readonly defaultConfig: RateLimitConfig;
  private readonly keyPrefix: string;

  constructor() {
    this.defaultConfig = {
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests,
      burst: config.rateLimit.burst,
    };
    this.keyPrefix = config.cache.prefix + ':ratelimit:';
  }

  /**
   * Check and consume rate limit for a given key (e.g., tenant ID)
   * Returns whether the request is allowed and remaining quota
   */
  async checkLimit(
    key: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const limitConfig = { ...this.defaultConfig, ...customConfig };
    const redisKey = `${this.keyPrefix}${key}`;
    const burstKey = `${this.keyPrefix}burst:${key}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();

      const now = Date.now();
      const windowStart = now - limitConfig.windowMs;

      // Get current counts
      pipeline.zcard(redisKey); // Sustained requests count
      pipeline.zcard(burstKey); // Burst requests count
      pipeline.zremrangebyscore(redisKey, 0, windowStart); // Clean old entries
      pipeline.zremrangebyscore(burstKey, 0, windowStart); // Clean old burst entries

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const sustainedCount = (results[0]?.[1] as number) || 0;
      const burstCount = (results[2]?.[1] as number) || 0;

      // Check sustained limit
      if (sustainedCount >= limitConfig.maxRequests) {
        // Calculate reset time (oldest request + window)
        const oldestRequest = await this.getOldestRequestTime(redisKey);
        const resetTime = oldestRequest
          ? oldestRequest + limitConfig.windowMs
          : now + limitConfig.windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000),
          limit: limitConfig.maxRequests + limitConfig.burst,
        };
      }

      // Check burst limit
      const totalCount = sustainedCount + burstCount;
      const totalLimit = limitConfig.maxRequests + limitConfig.burst;

      if (totalCount >= totalLimit) {
        // Calculate reset time
        const oldestRequest = await this.getOldestRequestTime(burstKey);
        const resetTime = oldestRequest
          ? oldestRequest + limitConfig.windowMs
          : now + limitConfig.windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000),
          limit: totalLimit,
        };
      }

      // Request is allowed - record it
      const score = now;
      if (sustainedCount < limitConfig.maxRequests) {
        // Use sustained bucket
        await redis.zadd(redisKey, score, `${score}:${Math.random()}`);
        await redis.expire(redisKey, Math.ceil(limitConfig.windowMs / 1000));
      } else {
        // Use burst bucket
        await redis.zadd(burstKey, score, `${score}:${Math.random()}`);
        await redis.expire(burstKey, Math.ceil(limitConfig.windowMs / 1000));
      }

      const remaining = totalLimit - (totalCount + 1);
      const resetTime = now + limitConfig.windowMs;

      return {
        allowed: true,
        remaining: Math.max(0, remaining),
        resetTime,
        limit: totalLimit,
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        error,
        key,
      });

      // On error, allow the request (fail open)
      // In production, you might want to fail closed for security
      return {
        allowed: true,
        remaining: limitConfig.maxRequests + limitConfig.burst,
        resetTime: Date.now() + limitConfig.windowMs,
        limit: limitConfig.maxRequests + limitConfig.burst,
      };
    }
  }

  /**
   * Get rate limit info without consuming a request
   */
  async getLimitInfo(
    key: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitInfo> {
    const limitConfig = { ...this.defaultConfig, ...customConfig };
    const redisKey = `${this.keyPrefix}${key}`;
    const burstKey = `${this.keyPrefix}burst:${key}`;

    try {
      const now = Date.now();
      const windowStart = now - limitConfig.windowMs;

      // Clean old entries
      await redis.zremrangebyscore(redisKey, 0, windowStart);
      await redis.zremrangebyscore(burstKey, 0, windowStart);

      // Get counts
      const sustainedCount = await redis.zcard(redisKey);
      const burstCount = await redis.zcard(burstKey);
      const totalCount = sustainedCount + burstCount;
      const totalLimit = limitConfig.maxRequests + limitConfig.burst;

      const remaining = Math.max(0, totalLimit - totalCount);
      const resetTime = now + limitConfig.windowMs;

      return {
        limit: totalLimit,
        remaining,
        reset: resetTime,
      };
    } catch (error) {
      logger.error('Get rate limit info failed', { error, key });
      // Return default values on error
      return {
        limit: limitConfig.maxRequests + limitConfig.burst,
        remaining: limitConfig.maxRequests + limitConfig.burst,
        reset: Date.now() + limitConfig.windowMs,
      };
    }
  }

  /**
   * Reset rate limit for a key (admin function)
   */
  async resetLimit(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}${key}`;
    const burstKey = `${this.keyPrefix}burst:${key}`;

    try {
      await redis.del(redisKey, burstKey);
      logger.info('Rate limit reset', { key });
    } catch (error) {
      logger.error('Rate limit reset failed', { error, key });
      throw error;
    }
  }

  /**
   * Get the oldest request time in a sorted set
   */
  private async getOldestRequestTime(key: string): Promise<number | null> {
    try {
      const result = await redis.zrange(key, 0, 0, 'WITHSCORES');
      if (result && result.length > 0) {
        return parseInt(result[1] as string, 10);
      }
      return null;
    } catch (error) {
      logger.error('Get oldest request time failed', { error, key });
      return null;
    }
  }

  /**
   * Get rate limit key for a tenant
   */
  getTenantKey(tenantId: string, endpoint?: string): string {
    if (endpoint) {
      return `tenant:${tenantId}:endpoint:${endpoint}`;
    }
    return `tenant:${tenantId}`;
  }

  /**
   * Get rate limit key for an IP address
   */
  getIPKey(ip: string, endpoint?: string): string {
    if (endpoint) {
      return `ip:${ip}:endpoint:${endpoint}`;
    }
    return `ip:${ip}`;
  }

  /**
   * Get rate limit key for a user
   */
  getUserKey(userId: string, endpoint?: string): string {
    if (endpoint) {
      return `user:${userId}:endpoint:${endpoint}`;
    }
    return `user:${userId}`;
  }
}

