import Redis from 'ioredis'
import logger from '../utils/logger'

let redis: Redis | null = null

try {
  const redisUrl = process.env.REDIS_URL
  const redisConfig = redisUrl
    ? { connectionString: redisUrl }
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      }

  redis = redisUrl
    ? new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true })
    : new Redis({ ...redisConfig as any, maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true })

  redis.on('connect', () => logger.info('✅ Redis connected'))
  redis.on('error', () => {
    // silently ignore - redis is optional
  })

  redis.connect().catch(() => {
    logger.warn('⚠️ Redis not available - caching disabled')
    redis = null
  })
} catch {
  logger.warn('⚠️ Redis not available - caching disabled')
  redis = null
}

export const blacklistToken = async (token: string, ttlSeconds: number) => {
  if (!redis) return
  try { await redis.setex(`bl:${token}`, ttlSeconds, '1') } catch {}
}

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  if (!redis) return false
  try {
    const result = await redis.get(`bl:${token}`)
    return result !== null
  } catch { return false }
}

export const setCache = async (key: string, value: unknown, ttlSeconds = 300) => {
  if (!redis) return
  try { await redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value)) } catch {}
}

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null
  try {
    const data = await redis.get(`cache:${key}`)
    return data ? (JSON.parse(data) as T) : null
  } catch { return null }
}

export const deleteCache = async (pattern: string) => {
  if (!redis) return
  try {
    const keys = await redis.keys(`cache:${pattern}*`)
    if (keys.length > 0) await redis.del(...keys)
  } catch {}
}

export default redis
