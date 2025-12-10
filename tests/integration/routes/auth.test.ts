import request from 'supertest';
import app from '../../../src/app';
import { authService } from '../../../src/services';

describe('Auth Routes', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should generate tokens for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
          roles: ['admin'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeGreaterThan(0);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          userId: 'invalid-uuid',
          tenantId: 'invalid-uuid',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const tokenPair = authService.generateTokenPair({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: tokenPair.refreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeGreaterThan(0);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid.token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should blacklist token on logout', async () => {
      const token = authService.generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
    });
  });

  describe('POST /api/v1/auth/api-key/generate', () => {
    it('should generate API key', async () => {
      const response = await request(app)
        .post('/api/v1/auth/api-key/generate')
        .send({
          keyId: 'key-123',
          tenantId: '00000000-0000-0000-0000-000000000000',
          permissions: ['read', 'write'],
          expiresInDays: 30,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.keyId).toBe('key-123');
      expect(response.body.data.tenantId).toBeDefined();
    });
  });
});

