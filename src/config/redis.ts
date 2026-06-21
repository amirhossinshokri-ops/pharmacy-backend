import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 200, 1000);
  },
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

// Blacklist revoked access tokens (expires with token TTL)
export const blacklistToken = async (token: string, ttlSeconds: number) => {
  await redis.setex(`bl:${token}`, ttlSeconds, '1');
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redis.get(`bl:${token}`);
  return result !== null;
};

// Cache helpers
export const setCache = async (key: string, value: unknown, ttlSeconds = 300) => {
  await redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(`cache:${key}`);
  return data ? (JSON.parse(data) as T) : null;
};

export const deleteCache = async (pattern: string) => {
  const keys = await redis.keys(`cache:${pattern}*`);
  if (keys.length > 0) await redis.del(...keys);
};

export default redis;
