import request from 'supertest';
import app from '../../../src/app';
import { authService } from '../../../src/services';

describe('Authentication Middleware', () => {
  describe('JWT Authentication', () => {
    it('should allow access with valid JWT token', async () => {
      const token = authService.generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      const response = await request(app)
        .get('/api/v1/features?tenant=tenant-456')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/features')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/features')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('API Key Authentication', () => {
    it('should allow access with valid API key', async () => {
      const apiKey = authService.generateAPIKey({
        keyId: 'key-123',
        tenantId: 'tenant-456',
        permissions: ['read', 'write'],
      });

      const response = await request(app)
        .get('/api/v1/features?tenant=tenant-456')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/features')
        .set('x-api-key', 'invalid-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Tenant Authorization', () => {
    it('should allow access when tenant matches', async () => {
      const token = authService.generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      const response = await request(app)
        .get('/api/v1/features?tenant=tenant-456')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject access when tenant does not match', async () => {
      const token = authService.generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });

      const response = await request(app)
        .get('/api/v1/features?tenant=tenant-999')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});

