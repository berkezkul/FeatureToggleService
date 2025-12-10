import { RateLimitService } from '../../../src/services/RateLimitService';
import { redis } from '../../../src/config/redis';

// Mock Redis
jest.mock('../../../src/config/redis', () => ({
  redis: {
    pipeline: jest.fn(),
    zcard: jest.fn(),
    zremrangebyscore: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    zrange: jest.fn(),
  },
}));

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitService = new RateLimitService();
  });

  describe('checkLimit', () => {
    it('should allow request when under limit', async () => {
      const mockPipeline = {
        zcard: jest.fn().mockReturnThis(),
        zremrangebyscore: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 5], // sustained count
          [null, 2], // burst count
          [null, 1], // cleaned sustained
          [null, 1], // cleaned burst
        ]),
      };

      (redis.pipeline as jest.Mock).mockReturnValue(mockPipeline);
      (redis.zadd as jest.Mock).mockResolvedValue(1);
      (redis.expire as jest.Mock).mockResolvedValue(1);

      const result = await rateLimitService.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        burst: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should reject request when over sustained limit', async () => {
      const mockPipeline = {
        zcard: jest.fn().mockReturnThis(),
        zremrangebyscore: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 10], // sustained count (at limit)
          [null, 0], // burst count
          [null, 1],
          [null, 1],
        ]),
      };

      (redis.pipeline as jest.Mock).mockReturnValue(mockPipeline);
      (redis.zrange as jest.Mock).mockResolvedValue(['1234567890', '1234567890']);

      const result = await rateLimitService.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        burst: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reject request when over total limit (sustained + burst)', async () => {
      const mockPipeline = {
        zcard: jest.fn().mockReturnThis(),
        zremrangebyscore: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 10], // sustained count (at limit)
          [null, 5], // burst count (at limit)
          [null, 1],
          [null, 1],
        ]),
      };

      (redis.pipeline as jest.Mock).mockReturnValue(mockPipeline);
      (redis.zrange as jest.Mock).mockResolvedValue(['1234567890', '1234567890']);

      const result = await rateLimitService.checkLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        burst: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('getLimitInfo', () => {
    it('should return limit info without consuming request', async () => {
      (redis.zremrangebyscore as jest.Mock).mockResolvedValue(1);
      (redis.zcard as jest.Mock)
        .mockResolvedValueOnce(5) // sustained count
        .mockResolvedValueOnce(2); // burst count

      const info = await rateLimitService.getLimitInfo('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        burst: 5,
      });

      expect(info.limit).toBe(15); // 10 + 5
      expect(info.remaining).toBe(8); // 15 - (5 + 2)
      expect(info.reset).toBeDefined();
    });
  });

  describe('resetLimit', () => {
    it('should reset rate limit for a key', async () => {
      (redis.del as jest.Mock).mockResolvedValue(2);

      await rateLimitService.resetLimit('test-key');

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('key generators', () => {
    it('should generate tenant key', () => {
      const key = rateLimitService.getTenantKey('tenant-123');
      expect(key).toBe('tenant:tenant-123');
    });

    it('should generate tenant key with endpoint', () => {
      const key = rateLimitService.getTenantKey('tenant-123', '/api/v1/features');
      expect(key).toBe('tenant:tenant-123:endpoint:/api/v1/features');
    });

    it('should generate IP key', () => {
      const key = rateLimitService.getIPKey('192.168.1.1');
      expect(key).toBe('ip:192.168.1.1');
    });

    it('should generate user key', () => {
      const key = rateLimitService.getUserKey('user-123');
      expect(key).toBe('user:user-123');
    });
  });
});

