import { CacheService } from '../../../src/services/CacheService';
import { redis } from '../../../src/config/redis';

// Mock Redis
jest.mock('../../../src/config/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    scan: jest.fn(),
  },
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService();
  });

  describe('get', () => {
    it('should return cached data when available', async () => {
      const testData = { id: '1', name: 'test' };
      const entry = {
        data: testData,
        metadata: {
          cachedAt: Date.now(),
          expiresAt: Date.now() + 300000,
          version: 'v1',
        },
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(entry));

      const result = await cacheService.get('test-key');

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(testData);
    });

    it('should return miss when key does not exist', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await cacheService.get('test-key');

      expect(result.hit).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('should return miss when entry is expired', async () => {
      const expiredEntry = {
        data: { id: '1' },
        metadata: {
          cachedAt: Date.now() - 600000,
          expiresAt: Date.now() - 300000, // Expired
          version: 'v1',
        },
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(expiredEntry));
      (redis.del as jest.Mock).mockResolvedValue(1);

      const result = await cacheService.get('test-key');

      expect(result.hit).toBe(false);
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set data in cache with TTL', async () => {
      const testData = { id: '1', name: 'test' };
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      const result = await cacheService.set('test-key', testData, { ttl: 300 });

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalled();
      
      const [key, ttl, value] = (redis.setex as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);
      expect(parsed.data).toEqual(testData);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.version).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      (redis.del as jest.Mock).mockResolvedValue(1);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      (redis.scan as jest.Mock)
        .mockResolvedValueOnce(['0', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', []]);
      (redis.del as jest.Mock).mockResolvedValue(2);

      const result = await cacheService.deletePattern('test:*');

      expect(result).toBe(2);
      expect(redis.del).toHaveBeenCalledWith('key1', 'key2');
    });
  });

  describe('invalidateTenantEnv', () => {
    it('should invalidate cache for tenant and env', async () => {
      (redis.scan as jest.Mock)
        .mockResolvedValueOnce(['0', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', []]);
      (redis.del as jest.Mock).mockResolvedValue(2);

      const result = await cacheService.invalidateTenantEnv('tenant-1', 'dev');

      expect(result).toBe(2);
    });
  });

  describe('key generators', () => {
    it('should generate feature flags list key', () => {
      const key = cacheService.getFeatureFlagsListKey('tenant-1', 'dev', 1, 10);
      expect(key).toBe('feature:tenant-1:dev:list:page:1:limit:10');
    });

    it('should generate feature flag key', () => {
      const key = cacheService.getFeatureFlagKey('tenant-1', 'feature-1', 'dev');
      expect(key).toBe('feature:tenant-1:feature-1:dev');
    });
  });
});

