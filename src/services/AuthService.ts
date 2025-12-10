import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, TokenPair, APIKeyPayload } from '../types/auth';
import { UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';
import { redis } from '../config/redis';

export class AuthService {
  private readonly jwtSecret: jwt.Secret;
  private readonly jwtExpiresIn: string | number;
  private readonly apiKeySecret: string;
  private readonly tokenBlacklistPrefix = 'token:blacklist:';
  private readonly apiKeyCachePrefix = 'api:key:';

  constructor() {
    this.jwtSecret = config.jwt.secret as jwt.Secret;
    this.jwtExpiresIn = config.jwt.expiresIn;
    this.apiKeySecret = config.api.keySecret;
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const tokenPayload: JWTPayload = {
      ...payload,
    };

    const signOptions: jwt.SignOptions = {
      // Cast to the exact type expected by jsonwebtoken
      expiresIn: this.jwtExpiresIn as unknown as jwt.SignOptions['expiresIn'],
      issuer: 'feature-toggle-service',
      audience: 'feature-toggle-api',
    };

    return jwt.sign(tokenPayload, this.jwtSecret, signOptions);
  }

  /**
   * Generate refresh token (optional, for future use)
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(
      { userId: payload.userId, tenantId: payload.tenantId },
      this.jwtSecret,
      {
        expiresIn: '7d', // Longer expiry for refresh tokens
        issuer: 'feature-toggle-service',
        audience: 'feature-toggle-api',
      }
    );
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Parse expiresIn to get seconds for clients
    const expiresIn = this.parseExpiresIn(this.jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.jwtSecret as jwt.Secret, {
        issuer: 'feature-toggle-service',
        audience: 'feature-toggle-api',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('JWT verification failed', { error: error.message });
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('JWT token expired', { error: error.message });
        throw new UnauthorizedError('Token expired');
      }
      throw error;
    }
  }

  /**
   * Blacklist a token (for logout)
   */
  async blacklistToken(token: string, expiresInSeconds?: number): Promise<void> {
    try {
      const ttl = expiresInSeconds || this.parseExpiresIn(this.jwtExpiresIn);
      await redis.setex(
        `${this.tokenBlacklistPrefix}${this.hashToken(token)}`,
        ttl,
        '1'
      );
    } catch (error) {
      logger.error('Failed to blacklist token', { error });
      // Don't throw - blacklisting is best effort
    }
  }

  /**
   * Check if token is blacklisted
   */
  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await redis.get(`${this.tokenBlacklistPrefix}${this.hashToken(token)}`);
      return result === '1';
    } catch (error) {
      logger.error('Failed to check token blacklist', { error });
      // On error, assume not blacklisted to avoid blocking valid requests
      return false;
    }
  }

  /**
   * Verify API Key
   * In a real implementation, this would check against a database
   * For now, we'll use a simple hash-based verification
   */
  async verifyAPIKey(apiKey: string): Promise<APIKeyPayload> {
    try {
      // Check cache first
      const cached = await this.getAPIKeyFromCache(apiKey);
      if (cached) {
        return cached;
      }

      // In production, this would query the database
      // For now, we'll decode a JWT-like structure
      const decoded = jwt.verify(apiKey, this.apiKeySecret, {
        issuer: 'feature-toggle-service',
        audience: 'feature-toggle-api',
      }) as APIKeyPayload;

      // Cache the API key info
      await this.cacheAPIKey(apiKey, decoded);

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid API key');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('API key expired');
      }
      throw error;
    }
  }

  /**
   * Generate API Key (for admin use)
   */
  generateAPIKey(payload: Omit<APIKeyPayload, 'createdAt'>): string {
    const tokenPayload: APIKeyPayload = {
      ...payload,
      createdAt: new Date(),
    };

    return jwt.sign(tokenPayload, this.apiKeySecret, {
      expiresIn: payload.expiresAt ? undefined : '365d', // Long-lived API keys
      issuer: 'feature-toggle-service',
      audience: 'feature-toggle-api',
    });
  }

  /**
   * Cache API key info
   */
  private async cacheAPIKey(apiKey: string, payload: APIKeyPayload): Promise<void> {
    try {
      const ttl = 3600; // Cache for 1 hour
      const key = `${this.apiKeyCachePrefix}${this.hashToken(apiKey)}`;
      await redis.setex(key, ttl, JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to cache API key', { error });
      // Don't throw - caching is best effort
    }
  }

  /**
   * Get API key from cache
   */
  private async getAPIKeyFromCache(apiKey: string): Promise<APIKeyPayload | null> {
    try {
      const key = `${this.apiKeyCachePrefix}${this.hashToken(apiKey)}`;
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as APIKeyPayload;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get API key from cache', { error });
      return null;
    }
  }

  /**
   * Hash token for storage (simple hash for blacklist/cache keys)
   */
  private hashToken(token: string): string {
    // Simple hash - in production, use crypto.createHash
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse expiresIn string to seconds
   */
  private parseExpiresIn(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default 1 hour
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 1);
  }
}

