import Redis, { RedisOptions } from 'ioredis';
import logger from './logger';

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
  lazyConnect: false,
  // Connection pool settings for better scalability
  enableReadyCheck: true,
  enableOfflineQueue: true,
  // Keep alive
  keepAlive: 30000,
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis connected', {
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err: Error) => {
  logger.error('Redis connection error', {
    error: err.message,
    stack: err.stack,
  });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.info('Redis reconnecting', { delay });
});

// Graceful shutdown
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
    // Force disconnect if quit fails
    redis.disconnect();
  }
};

export default redis;

