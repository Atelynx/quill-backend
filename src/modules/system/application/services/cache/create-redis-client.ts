import Redis from 'ioredis';

export function createRedisClient(
  url: string,
  onError: (error: Error) => void,
): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on('error', onError);
  redis.on('connect', () => {
    console.log('[Redis] Connected');
  });
  redis.on('close', () => {
    console.warn('[Redis] Connection closed');
  });
  redis.on('reconnecting', () => {
    console.warn('[Redis] Reconnecting...');
  });
  redis.on('end', () => {
    console.error('[Redis] Connection ended');
  });
  return redis;
}
