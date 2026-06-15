const redisStorage = jest.fn();

jest.mock('@nest-lab/throttler-storage-redis', () => ({
  ThrottlerStorageRedisService: redisStorage,
}));

import { ConfigService } from '@nestjs/config';
import {
  AUTH_THROTTLER_REDIS_OPTIONS,
  createAuthThrottlerOptions,
} from './auth-throttler.config';

describe('createAuthThrottlerOptions', () => {
  it.each(['development', 'test'])(
    'usa storage en memoria en %s',
    (environment) => {
      const config = {
        get: jest.fn().mockReturnValue(environment),
      } as unknown as ConfigService;

      expect(createAuthThrottlerOptions(config)).toEqual([
        { ttl: 60000, limit: 100 },
      ]);
      expect(redisStorage).not.toHaveBeenCalled();
    },
  );

  it('usa storage Redis compartido en producción', () => {
    const config = {
      get: jest.fn().mockReturnValue('production'),
      getOrThrow: jest.fn().mockReturnValue('redis://cache:6379'),
    } as unknown as ConfigService;

    const result = createAuthThrottlerOptions(config);

    expect(redisStorage).toHaveBeenCalledWith(
      'redis://cache:6379',
      AUTH_THROTTLER_REDIS_OPTIONS,
    );
    expect(result).toMatchObject({ throttlers: [{ ttl: 60000, limit: 100 }] });
  });

  it('falla explícitamente sin REDIS_URL en producción', () => {
    const config = {
      get: jest.fn().mockReturnValue('production'),
      getOrThrow: jest.fn().mockImplementation(() => {
        throw new Error('REDIS_URL requerida');
      }),
    } as unknown as ConfigService;

    expect(() => createAuthThrottlerOptions(config)).toThrow(
      'REDIS_URL requerida',
    );
  });
});
