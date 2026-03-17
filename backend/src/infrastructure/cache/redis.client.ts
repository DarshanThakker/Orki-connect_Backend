import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

class RedisClient {
  private static instance: Redis;

  private constructor() { }

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url, {
        password: config.redis.password,
        username: config.redis.username,
        db: config.redis.db,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      RedisClient.instance.on('connect', () => logger.info('Redis connected'));
      RedisClient.instance.on('error', (err) => logger.error('Redis error', { err: err.message }));
      RedisClient.instance.on('close', () => logger.warn('Redis connection closed'));
    }
    return RedisClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      logger.info('Redis disconnected');
    }
  }
}

export const redis = RedisClient.getInstance();
export const disconnectRedis = RedisClient.disconnect;

// TTLs (seconds)
export const TTL = {
  ORG_CONFIG: 5 * 60,      // 5 minutes
  SESSION: 2 * 60,          // 2 minutes
  DAILY_LIMIT_EXPIRY: 26 * 60 * 60, // 26 hours — covers midnight rollover
} as const;
