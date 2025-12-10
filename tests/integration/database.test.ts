import { knexInstance } from '../../src/config/database';
import { cleanDatabase, setupTestDatabase, teardownTestDatabase } from '../setup';

describe('Database Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Database Connection', () => {
    it('should connect to database', async () => {
      const result = await knexInstance.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should handle transactions', async () => {
      await knexInstance.transaction(async (trx) => {
        await trx('tenants').insert({ name: 'test-tenant' });
        // Transaction will rollback automatically in test
      });

      // After rollback, tenant should not exist
      const tenants = await knexInstance('tenants').where({ name: 'test-tenant' });
      expect(tenants.length).toBe(0);
    });
  });

  describe('Database Models', () => {
    it('should create and retrieve tenant', async () => {
      const [tenant] = await knexInstance('tenants')
        .insert({ name: 'test-tenant' })
        .returning('*');

      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe('test-tenant');

      const retrieved = await knexInstance('tenants')
        .where({ id: tenant.id })
        .first();

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('test-tenant');
    });

    it('should enforce foreign key constraints', async () => {
      // Try to insert feature_flag with invalid tenant_id
      await expect(
        knexInstance('feature_flags').insert({
          tenant_id: '00000000-0000-0000-0000-000000000000',
          feature_id: '00000000-0000-0000-0000-000000000000',
          env: 'dev',
          enabled: true,
        })
      ).rejects.toThrow();
    });
  });
});

