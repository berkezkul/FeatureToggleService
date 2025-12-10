import request from 'supertest';
import app from '../../../src/app';
import { authService } from '../../../src/services';
import { knexInstance } from '../../../src/config/database';
import { cleanDatabase } from '../../setup';

describe('Audit Logs API', () => {
  let token: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await knexInstance.migrate.latest();
    token = authService.generateAccessToken({
      userId: 'user-123',
      tenantId,
    });
  });

  afterAll(async () => {
    await knexInstance.migrate.rollback();
    await knexInstance.destroy();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/v1/audit-logs', () => {
    it('should return empty list when no logs exist', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should filter by entity type', async () => {
      // Create test audit log
      await knexInstance('audit_logs').insert({
        action: 'CREATE',
        entity_type: 'feature_flag',
        entity_id: 'flag-1',
        actor: 'user-1',
        old_value: null,
        new_value: { enabled: true },
      });

      const response = await request(app)
        .get('/api/v1/audit-logs?entity_type=feature_flag')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBeGreaterThan(0);
      expect(response.body.data.data[0].entity_type).toBe('feature_flag');
    });

    it('should filter by action', async () => {
      await knexInstance('audit_logs').insert({
        action: 'CREATE',
        entity_type: 'feature_flag',
        entity_id: 'flag-1',
        actor: 'user-1',
      });

      const response = await request(app)
        .get('/api/v1/audit-logs?action=CREATE')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data[0].action).toBe('CREATE');
    });

    it('should support pagination', async () => {
      // Create multiple logs
      for (let i = 0; i < 5; i++) {
        await knexInstance('audit_logs').insert({
          action: 'CREATE',
          entity_type: 'feature_flag',
          entity_id: `flag-${i}`,
          actor: 'user-1',
        });
      }

      const response = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBe(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(5);
    });

    it('should validate date range', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?start_date=2025-01-31T00:00:00Z&end_date=2025-01-01T00:00:00Z')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Start date must be before end date');
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should return specific audit log', async () => {
      const [log] = await knexInstance('audit_logs')
        .insert({
          action: 'CREATE',
          entity_type: 'feature_flag',
          entity_id: 'flag-1',
          actor: 'user-1',
        })
        .returning('*');

      const response = await request(app)
        .get(`/api/v1/audit-logs/${log.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(log.id);
    });

    it('should return 404 for non-existent log', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/audit-logs/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/audit-logs/entity/:entityType/:entityId', () => {
    it('should return logs for specific entity', async () => {
      await knexInstance('audit_logs').insert({
        action: 'CREATE',
        entity_type: 'feature_flag',
        entity_id: 'flag-1',
        actor: 'user-1',
      });

      const response = await request(app)
        .get('/api/v1/audit-logs/entity/feature_flag/flag-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBeGreaterThan(0);
      expect(response.body.data.data[0].entity_id).toBe('flag-1');
    });
  });
});

