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
  return redis;
}
