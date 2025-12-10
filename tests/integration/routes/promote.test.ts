import request from 'supertest';
import app from '../../../src/app';
import { authService } from '../../../src/services';
import { knexInstance } from '../../../src/config/database';
import { cleanDatabase } from '../../setup';

describe('Promotion API', () => {
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

  describe('POST /api/v1/promote', () => {
    it('should promote flags in dry-run mode', async () => {
      // Create source flag
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      const [feature] = await knexInstance('features')
        .insert({ name: 'test-feature' })
        .returning('*');

      await knexInstance('feature_flags').insert({
        tenant_id: tenant.id,
        feature_id: feature.id,
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
      });

      const response = await request(app)
        .post('/api/v1/promote')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenant_id: tenant.id,
          source_env: 'dev',
          target_env: 'staging',
          dry_run: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dryRun).toBe(true);
      expect(response.body.data.promoted).toBeGreaterThanOrEqual(0);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/promote')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenant_id: 'invalid-uuid',
          source_env: 'invalid-env',
          target_env: 'prod',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject invalid promotion path', async () => {
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      const response = await request(app)
        .post('/api/v1/promote')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenant_id: tenant.id,
          source_env: 'prod',
          target_env: 'dev', // Invalid: can't go backwards
          dry_run: true,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid promotion path');
    });

    it('should handle conflict resolution', async () => {
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      const [feature] = await knexInstance('features')
        .insert({ name: 'test-feature' })
        .returning('*');

      // Create source flag
      await knexInstance('feature_flags').insert({
        tenant_id: tenant.id,
        feature_id: feature.id,
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
      });

      // Create conflicting target flag
      await knexInstance('feature_flags').insert({
        tenant_id: tenant.id,
        feature_id: feature.id,
        env: 'staging',
        enabled: false, // Conflict!
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: false } },
      });

      const response = await request(app)
        .post('/api/v1/promote')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenant_id: tenant.id,
          source_env: 'dev',
          target_env: 'staging',
          dry_run: true,
          conflict_resolution: 'skip',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conflicts.length).toBeGreaterThan(0);
    });
  });
});

