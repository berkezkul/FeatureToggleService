import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthResult, JWTPayload, APIKeyPayload } from '../types/auth';
import { UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

// Extend Express Request to include auth data
declare global {
  namespace Express {
    interface Request {
      auth?: AuthResult;
      user?: JWTPayload;
      apiKey?: APIKeyPayload;
    }
  }
}

export class AuthenticationMiddleware {
  constructor(private authService: AuthService) {}

  /**
   * Authenticate request using JWT or API Key
   */
  authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Try JWT first
      const jwtToken = this.extractJWTToken(req);
      if (jwtToken) {
        const payload = await this.authService.verifyToken(jwtToken);
        req.auth = {
          authenticated: true,
          user: {
            id: payload.userId,
            tenantId: payload.tenantId,
            email: payload.email,
            roles: payload.roles,
          },
          method: 'jwt',
        };
        req.user = payload;
        return next();
      }

      // Try API Key
      const apiKey = this.extractAPIKey(req);
      if (apiKey) {
        const payload = await this.authService.verifyAPIKey(apiKey);
        req.auth = {
          authenticated: true,
          apiKey: {
            keyId: payload.keyId,
            tenantId: payload.tenantId,
            permissions: payload.permissions,
          },
          method: 'api-key',
        };
        req.apiKey = payload;
        return next();
      }

      // No authentication provided
      throw new UnauthorizedError('Authentication required. Provide JWT token or API key.');
    } catch (error) {
      // Track auth failures
      const { metrics, METRIC_NAMES } = await import('../utils/metrics');
      metrics.increment(METRIC_NAMES.AUTH_FAILURES_TOTAL, {
        reason: error instanceof UnauthorizedError ? 'missing_auth' : 'auth_error',
      });

      if (error instanceof UnauthorizedError) {
        next(error);
      } else {
        logger.error('Authentication error', { error });
        next(new UnauthorizedError('Authentication failed'));
      }
    }
  };

  /**
   * Optional authentication - doesn't fail if no auth provided
   */
  optional = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Try JWT first
      const jwtToken = this.extractJWTToken(req);
      if (jwtToken) {
        const payload = await this.authService.verifyToken(jwtToken);
        req.auth = {
          authenticated: true,
          user: {
            id: payload.userId,
            tenantId: payload.tenantId,
            email: payload.email,
            roles: payload.roles,
          },
          method: 'jwt',
        };
        req.user = payload;
        return next();
      }

      // Try API Key
      const apiKey = this.extractAPIKey(req);
      if (apiKey) {
        const payload = await this.authService.verifyAPIKey(apiKey);
        req.auth = {
          authenticated: true,
          apiKey: {
            keyId: payload.keyId,
            tenantId: payload.tenantId,
            permissions: payload.permissions,
          },
          method: 'api-key',
        };
        req.apiKey = payload;
        return next();
      }

      // No authentication - continue without auth
      req.auth = {
        authenticated: false,
        method: 'none',
      };
      next();
    } catch (error) {
      // On error, continue without auth (optional mode)
      logger.warn('Optional authentication failed', { error });
      req.auth = {
        authenticated: false,
        method: 'none',
      };
      next();
    }
  };

  /**
   * Extract JWT token from request
   */
  private extractJWTToken(req: Request): string | null {
    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check x-access-token header (alternative)
    const accessToken = req.headers['x-access-token'] as string;
    if (accessToken) {
      return accessToken;
    }

    return null;
  }

  /**
   * Extract API Key from request
   */
  private extractAPIKey(req: Request): string | null {
    // Check x-api-key header
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      return apiKey;
    }

    // Check Authorization header: ApiKey <key>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}

// Export singleton instance
export const authenticationMiddleware = new AuthenticationMiddleware(new AuthService());

