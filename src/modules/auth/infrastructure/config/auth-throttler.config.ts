import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

const throttlers = [
  {
    ttl: 60000,
    limit: 100,
  },
];
export const AUTH_THROTTLER_REDIS_OPTIONS: RedisOptions = {
  connectTimeout: 3000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
};

export function createAuthThrottlerOptions(
  configService: ConfigService,
): ThrottlerModuleOptions {
  if (configService.get<string>('NODE_ENV', 'development') !== 'production') {
    return throttlers;
  }

  const redisUrl = configService.getOrThrow<string>('REDIS_URL');
  return {
    throttlers,
    storage: new ThrottlerStorageRedisService(
      redisUrl,
      AUTH_THROTTLER_REDIS_OPTIONS,
    ),
  };
}
