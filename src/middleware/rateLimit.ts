import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../services/RateLimitService';
import { RateLimitConfig } from '../types/rateLimit';
import { TooManyRequestsError } from '../utils/errors';
import { metrics, METRIC_NAMES } from '../utils/metrics';
import logger from '../config/logger';

export interface RateLimitOptions {
  config?: Partial<RateLimitConfig>;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response, info: any) => void;
}

/**
 * Rate Limiting Middleware
 * 
 * Supports multiple key strategies:
 * - Tenant-based (default for authenticated requests)
 * - IP-based (for unauthenticated requests)
 * - User-based (optional)
 * - Endpoint-based (optional)
 */
export class RateLimitMiddleware {
  constructor(private rateLimitService: RateLimitService) {}

  /**
   * Create rate limit middleware with custom options
   */
  create(options: RateLimitOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Generate rate limit key
        const key = options.keyGenerator
          ? options.keyGenerator(req)
          : this.getDefaultKey(req);

        // Check rate limit
        const result = await this.rateLimitService.checkLimit(key, options.config);

        // Set rate limit headers
        this.setRateLimitHeaders(res, result);

        if (!result.allowed) {
          // Call custom handler if provided
          if (options.onLimitReached) {
            options.onLimitReached(req, res, result);
          }

          // Log rate limit exceeded
          logger.warn('Rate limit exceeded', {
            key,
            ip: req.ip,
            path: req.path,
            method: req.method,
            retryAfter: result.retryAfter,
          });

          // Track rate limit exceeded
          metrics.increment(METRIC_NAMES.RATE_LIMIT_EXCEEDED_TOTAL, {
            path: req.path,
            method: req.method,
          });

          throw new TooManyRequestsError(
            `Rate limit exceeded. Retry after ${result.retryAfter} seconds.`,
            result.retryAfter
          );
        }

        // Track response status if needed
        if (options.skipSuccessfulRequests || options.skipFailedRequests) {
          const originalSend = res.send;
          res.send = function (body) {
            const statusCode = res.statusCode;
            const isSuccess = statusCode >= 200 && statusCode < 400;
            const isFailure = statusCode >= 400;

            // If we should skip based on status, don't count this request
            if (
              (options.skipSuccessfulRequests && isSuccess) ||
              (options.skipFailedRequests && isFailure)
            ) {
              // Request was not counted, so we need to adjust headers
              // This is a simplified approach - in production, you might want
              // to refund the consumed limit
            }

            return originalSend.call(this, body);
          };
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Default key generator: tenant-based for authenticated, IP-based otherwise
   */
  private getDefaultKey(req: Request): string {
    // Try tenant-based first (for authenticated requests)
    if (req.auth?.authenticated) {
      const tenantId = req.user?.tenantId || req.apiKey?.tenantId;
      if (tenantId) {
        return this.rateLimitService.getTenantKey(tenantId, req.path);
      }

      // Fallback to user-based
      const userId = req.user?.userId || req.apiKey?.keyId;
      if (userId) {
        return this.rateLimitService.getUserKey(userId, req.path);
      }
    }

    // Fallback to IP-based
    const ip = this.getClientIP(req);
    return this.rateLimitService.getIPKey(ip, req.path);
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Set rate limit headers in response
   */
  private setRateLimitHeaders(res: Response, result: any): void {
    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    res.setHeader('X-RateLimit-Reset-After', result.retryAfter?.toString() || '0');

    if (!result.allowed && result.retryAfter) {
      res.setHeader('Retry-After', result.retryAfter.toString());
    }
  }
}

// Export singleton instance
export const rateLimitMiddleware = new RateLimitMiddleware(new RateLimitService());

