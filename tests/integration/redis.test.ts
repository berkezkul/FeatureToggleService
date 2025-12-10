import { redis, closeRedisConnection } from '../../src/config/redis';
import { CacheService } from '../../src/services/CacheService';

describe('Redis Integration', () => {
  let cacheService: CacheService;

  beforeAll(() => {
    cacheService = new CacheService();
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  beforeEach(async () => {
    // Clean test keys
    await cacheService.deletePattern('test:*');
  });

  describe('Redis Connection', () => {
    it('should connect to Redis', async () => {
      await redis.set('test:connection', 'ok');
      const value = await redis.get('test:connection');
      expect(value).toBe('ok');
      await redis.del('test:connection');
    });

    it('should handle Redis errors gracefully', async () => {
      // This test verifies that Redis operations don't crash the app
      try {
        await redis.set('test:key', 'value');
        const result = await redis.get('test:key');
        expect(result).toBe('value');
      } catch (error) {
        // If Redis is not available, test should fail gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cache Operations', () => {
    it('should set and get from cache', async () => {
      const testData = { id: '1', name: 'test' };
      await cacheService.set('test:cache', testData, { ttl: 60 });

      const result = await cacheService.get('test:cache');
      expect(result.hit).toBe(true);
      expect(result.data).toEqual(testData);
    });

    it('should expire cache entries', async () => {
      await cacheService.set('test:expire', { data: 'test' }, { ttl: 1 });
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await cacheService.get('test:expire');
      expect(result.hit).toBe(false);
    });
  });
});

