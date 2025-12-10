import { AuthService } from '../../../src/services/AuthService';
import { UnauthorizedError } from '../../../src/utils/errors';
import jwt from 'jsonwebtoken';
import { config } from '../../../src/config';

// Mock Redis
jest.mock('../../../src/config/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        roles: ['admin'],
      };

      const token = authService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tenantId).toBe(payload.tenantId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roles).toEqual(payload.roles);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      const tokenPair = authService.generateTokenPair(payload);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeGreaterThan(0);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      const token = authService.generateAccessToken(payload);
      const verified = await authService.verifyToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.tenantId).toBe(payload.tenantId);
    });

    it('should throw UnauthorizedError for invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(authService.verifyToken(invalidToken)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should throw UnauthorizedError for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', tenantId: 'tenant-456' },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      await expect(authService.verifyToken(expiredToken)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', async () => {
      const { redis } = require('../../../src/config/redis');
      redis.setex.mockResolvedValue('OK');

      const token = authService.generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      await authService.blacklistToken(token);

      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('generateAPIKey', () => {
    it('should generate a valid API key', () => {
      const payload = {
        keyId: 'key-123',
        tenantId: 'tenant-456',
        permissions: ['read', 'write'],
      };

      const apiKey = authService.generateAPIKey(payload);

      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
    });
  });

  describe('verifyAPIKey', () => {
    it('should verify a valid API key', async () => {
      const payload = {
        keyId: 'key-123',
        tenantId: 'tenant-456',
        permissions: ['read'],
      };

      const apiKey = authService.generateAPIKey(payload);
      const verified = await authService.verifyAPIKey(apiKey);

      expect(verified.keyId).toBe(payload.keyId);
      expect(verified.tenantId).toBe(payload.tenantId);
    });

    it('should throw UnauthorizedError for invalid API key', async () => {
      const invalidKey = 'invalid.key.here';

      await expect(authService.verifyAPIKey(invalidKey)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});

