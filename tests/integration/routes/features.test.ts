import request from 'supertest';
import app from '../../../src/app';
import { knexInstance } from '../../../src/config/database';
import { cleanDatabase } from '../../setup';

describe('Feature Flags API', () => {
  beforeAll(async () => {
    // Setup test database
    await knexInstance.migrate.latest();
  });

  afterAll(async () => {
    await knexInstance.migrate.rollback();
    await knexInstance.destroy();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/v1/features', () => {
    it('should return empty list when no flags exist', async () => {
      const response = await request(app)
        .get('/api/v1/features')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/features?page=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/features', () => {
    it('should create a new feature flag', async () => {
      // First create tenant and feature
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      const [feature] = await knexInstance('features')
        .insert({ name: 'test-feature', description: 'Test feature' })
        .returning('*');

      const response = await request(app)
        .post('/api/v1/features')
        .send({
          tenant_id: tenant.id,
          feature_id: feature.id,
          env: 'dev',
          enabled: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.env).toBe('dev');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/features')
        .send({
          tenant_id: 'invalid-uuid',
          feature_id: 'invalid-uuid',
          env: 'invalid-env',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/v1/features/:id', () => {
    it('should delete a feature flag', async () => {
      // Create test data
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      const [feature] = await knexInstance('features')
        .insert({ name: 'test-feature' })
        .returning('*');

      const [flag] = await knexInstance('feature_flags')
        .insert({
          tenant_id: tenant.id,
          feature_id: feature.id,
          env: 'dev',
          enabled: true,
        })
        .returning('*');

      const response = await request(app)
        .delete(`/api/v1/features/${flag.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Feature flag deleted successfully');
    });

    it('should return 404 when flag not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/features/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});

