import request from 'supertest';
import app from '../../../src/app';
import { authService } from '../../../src/services';

describe('Metrics API', () => {
  let token: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(() => {
    token = authService.generateAccessToken({
      userId: 'user-123',
      tenantId,
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus format metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return JSON format metrics', async () => {
      const response = await request(app)
        .get('/metrics/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });
  });
});

