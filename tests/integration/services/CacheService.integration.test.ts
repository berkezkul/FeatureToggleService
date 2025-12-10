import { CacheService } from '../../../src/services/CacheService';
import { redis } from '../../../src/config/redis';

describe('CacheService Integration', () => {
  let cacheService: CacheService;

  beforeAll(() => {
    cacheService = new CacheService();
  });

  afterEach(async () => {
    // Clean up test keys
    await cacheService.deletePattern('test:*');
  });

  describe('Cache operations', () => {
    it('should set and get data from cache', async () => {
      const testData = { id: '1', name: 'test' };
      const key = 'test:set-get';

      // Set
      const setResult = await cacheService.set(key, testData, { ttl: 60 });
      expect(setResult).toBe(true);

      // Get
      const getResult = await cacheService.get(key);
      expect(getResult.hit).toBe(true);
      expect(getResult.data).toEqual(testData);
    });

    it('should expire data after TTL', async () => {
      const testData = { id: '1' };
      const key = 'test:expire';

      // Set with short TTL
      await cacheService.set(key, testData, { ttl: 1 }); // 1 second

      // Get immediately - should be there
      let result = await cacheService.get(key);
      expect(result.hit).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Get after expiration - should be gone
      result = await cacheService.get(key);
      expect(result.hit).toBe(false);
    });

    it('should delete key from cache', async () => {
      const testData = { id: '1' };
      const key = 'test:delete';

      // Set
      await cacheService.set(key, testData);

      // Verify it exists
      let result = await cacheService.get(key);
      expect(result.hit).toBe(true);

      // Delete
      const deleted = await cacheService.delete(key);
      expect(deleted).toBe(true);

      // Verify it's gone
      result = await cacheService.get(key);
      expect(result.hit).toBe(false);
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate tenant and env cache', async () => {
      const tenantId = 'test-tenant';
      const env = 'dev';

      // Set some cache entries
      await cacheService.set(
        cacheService.getFeatureFlagsListKey(tenantId, env),
        { data: [] }
      );
      await cacheService.set(
        cacheService.getFeatureFlagKey(tenantId, 'feature-1', env),
        { id: '1' }
      );

      // Invalidate
      const deleted = await cacheService.invalidateTenantEnv(tenantId, env);
      expect(deleted).toBeGreaterThan(0);
    });
  });
});

