import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/CacheService';

/**
 * ETag middleware for cache validation
 * Supports If-None-Match header for conditional requests
 */
export class CacheMiddleware {
  constructor(private cacheService: CacheService) {}

  /**
   * Generate ETag from cache metadata
   */
  async getETag(key: string): Promise<string | null> {
    const metadata = await this.cacheService.getMetadata(key);
    return metadata?.version || null;
  }

  /**
   * Check if request has matching ETag (304 Not Modified)
   */
  async checkETag(req: Request, res: Response, cacheKey: string): Promise<boolean> {
    const ifNoneMatch = req.headers['if-none-match'];
    if (!ifNoneMatch) {
      return false;
    }

    const etag = await this.getETag(cacheKey);
    if (!etag) {
      return false;
    }

    // Remove quotes if present
    const clientETag = ifNoneMatch.replace(/^"|"$/g, '');

    if (clientETag === etag) {
      res.status(304).end();
      return true; // Response already sent
    }

    // Set ETag header
    res.setHeader('ETag', `"${etag}"`);
    return false;
  }

  /**
   * Set cache headers in response
   */
  setCacheHeaders(res: Response, maxAge: number = 300): void {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.setHeader('Vary', 'Authorization'); // Cache varies by auth
  }

  /**
   * Middleware to add ETag support to responses
   */
  etag(cacheKeyGenerator: (req: Request) => string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const cacheKey = cacheKeyGenerator(req);
      const handled = await this.checkETag(req, res, cacheKey);

      if (!handled) {
        // Set cache headers
        this.setCacheHeaders(res);

        // Store original send function
        const originalSend = res.send;
        res.send = function (body) {
          // Set ETag if not already set
          if (!res.getHeader('ETag')) {
            // ETag will be set by cache service when caching
          }
          return originalSend.call(this, body);
        };

        next();
      }
    };
  }
}

// Export singleton instance
export const cacheMiddleware = new CacheMiddleware(new CacheService());

