import { ConfigService } from '@nestjs/config';

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  on: jest.fn(),
  status: 'ready',
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(undefined),
  eval: jest.fn().mockResolvedValue(1),
  flushdb: jest.fn().mockResolvedValue(undefined),
  flushall: jest.fn().mockResolvedValue(undefined),
  keys: jest.fn().mockResolvedValue([]),
  pttl: jest.fn().mockResolvedValue(-1),
};

jest.mock('ioredis', () => jest.fn(() => mockRedisInstance));

import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { Logger, ServiceUnavailableException } from '@nestjs/common';

describe('CacheService', () => {
  let service: CacheService;
  let config: Partial<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisInstance.status = 'ready';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('initialization', () => {
    it('skips Redis when REDIS_URL is not set', async () => {
      config = { get: jest.fn().mockReturnValue(undefined) };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
      expect(service.isConnected()).toBe(false);
    });

    it('initializes Redis when REDIS_URL is provided', async () => {
      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.any(Object),
      );
      expect(mockRedisInstance.connect).toHaveBeenCalled();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it('falls back to in-memory store when Redis fails to connect', async () => {
      mockRedisInstance.connect.mockRejectedValueOnce(
        new Error('connect fail'),
      );

      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
      expect(service.isConnected()).toBe(false);
      await service.set('key1', { a: 1 }, 1000);
      const v = await service.get<{ a: number }>('key1');
      expect(v).toEqual({ a: 1 });
    });

    it('rejects cache operations in production when Redis fails', async () => {
      mockRedisInstance.connect.mockRejectedValueOnce(
        new Error('connect fail'),
      );
      config = {
        get: jest.fn((key: string) =>
          key === 'NODE_ENV' ? 'production' : 'redis://localhost:6379',
        ),
      };
      service = new CacheService(config as ConfigService);

      await service.onModuleInit();

      await expect(service.set('critical', 'value')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(service.get('critical')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('quits Redis gracefully when connected', async () => {
      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('disconnects forcefully if quit throws', async () => {
      mockRedisInstance.quit.mockRejectedValueOnce(new Error('quit fail'));
      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockRedisInstance.disconnect).toHaveBeenCalledWith(false);
    });

    it('does nothing if Redis was never initialized', async () => {
      config = { get: jest.fn().mockReturnValue(undefined) };
      service = new CacheService(config as ConfigService);
      await service.onModuleDestroy();
    });
  });

  describe('in-memory fallback mode', () => {
    beforeEach(() => {
      config = { get: jest.fn().mockReturnValue(undefined) };
      service = new CacheService(config as ConfigService);
    });

    it('set and get a string value', async () => {
      await service.set('str', 'hello');
      expect(await service.get('str')).toBe('hello');
    });

    it('set and get an object value', async () => {
      const obj = { foo: [1, 2, 3] };
      await service.set('obj', obj);
      expect(await service.get('obj')).toEqual(obj);
    });

    it('expires values according to ttl and removes them when read', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      await service.set('expiring', 'value', 100);

      now.mockReturnValue(1100);

      expect(await service.get('expiring')).toBeUndefined();
      expect(await service.keys()).not.toContain('expiring');
    });

    it('keeps values without ttl', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      await service.set('persistent', 'value');

      now.mockReturnValue(1_000_000);

      expect(await service.get('persistent')).toBe('value');
      expect(await service.ttl('persistent')).toBe(-1);
    });

    it('evicts the oldest entry when the fallback reaches its limit', async () => {
      await service.set('oldest', 'value');
      for (let index = 0; index < 1000; index++) {
        await service.set(`key-${index}`, index);
      }

      expect(await service.get('oldest')).toBeUndefined();
      expect(await service.get('key-999')).toBe(999);
      expect(await service.keys()).toHaveLength(1000);
    });

    it('returns undefined for missing keys', async () => {
      expect(await service.get('nonexistent')).toBeUndefined();
    });

    it('del removes a key', async () => {
      await service.set('delme', 'value');
      await service.del('delme');
      expect(await service.get('delme')).toBeUndefined();
    });

    it('delete returns true if key existed', async () => {
      await service.set('exists', 'val');
      const result = await service.delete('exists');
      expect(result).toBe(true);
      expect(await service.get('exists')).toBeUndefined();
    });

    it('delete returns false if key did not exist', async () => {
      const result = await service.delete('nope');
      expect(result).toBe(false);
    });

    it('reset clears all keys', async () => {
      await service.set('a', 1);
      await service.set('b', 2);
      await service.reset();
      expect(await service.get('a')).toBeUndefined();
      expect(await service.get('b')).toBeUndefined();
    });

    it('clear delegates to reset', async () => {
      await service.set('x', 1);
      await service.clear();
      expect(await service.get('x')).toBeUndefined();
    });

    it('ttl returns -1 in fallback mode', async () => {
      await service.set('k', 'v');
      expect(await service.ttl('k')).toBe(-1);
    });

    it('mget returns values for multiple keys', async () => {
      await service.set('k1', 'v1');
      await service.set('k2', 'v2');
      const results = await service.mget('k1', 'k2', 'missing');
      expect(results).toEqual(['v1', 'v2', undefined]);
    });

    it('mset stores a batch of key-value pairs', async () => {
      await service.mset({ a: 1, b: 2 }, 500);
      expect(await service.get('a')).toBe(1);
      expect(await service.get('b')).toBe(2);
    });

    it('mdel removes multiple keys', async () => {
      await service.set('a', 1);
      await service.set('b', 2);
      await service.mdel('a', 'b');
      expect(await service.get('a')).toBeUndefined();
      expect(await service.get('b')).toBeUndefined();
    });

    it('keys returns all stored keys', async () => {
      await service.set('alpha', 1);
      await service.set('beta', 2);
      const keys = await service.keys();
      expect(keys).toEqual(expect.arrayContaining(['alpha', 'beta']));
      expect(keys).toHaveLength(2);
    });
  });

  describe('Redis mode', () => {
    beforeEach(async () => {
      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();
    });

    it('set delegates to redis.set with PX ttl', async () => {
      await service.set('k', 'v', 5000);
      expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v', 'PX', 5000);
    });

    it('set delegates to redis.set without ttl', async () => {
      await service.set('k', 'v');
      expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v');
    });

    it('get reads from redis and parses JSON', async () => {
      mockRedisInstance.get.mockResolvedValueOnce('{"a":1}');
      const val = await service.get<{ a: number }>('k');
      expect(val).toEqual({ a: 1 });
    });

    it('get returns raw string if JSON parse fails', async () => {
      mockRedisInstance.get.mockResolvedValueOnce('not-json');
      const val = await service.get('k');
      expect(val).toBe('not-json');
    });

    it('get returns undefined when redis returns null', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);
      const val = await service.get('k');
      expect(val).toBeUndefined();
    });

    it('del delegates to redis.del', async () => {
      await service.del('k');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('k');
    });

    it('delete calls get and del, returns true when key existed', async () => {
      mockRedisInstance.get.mockResolvedValueOnce('exists');
      const result = await service.delete('k');
      expect(result).toBe(true);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('k');
    });

    it('reset clears only the selected Redis database', async () => {
      await service.reset();
      expect(mockRedisInstance.flushdb).toHaveBeenCalled();
      expect(mockRedisInstance.flushall).not.toHaveBeenCalled();
    });

    it('ttl delegates to redis.pttl', async () => {
      mockRedisInstance.pttl.mockResolvedValueOnce(1234);
      expect(await service.ttl('k')).toBe(1234);
    });

    it('mget resolves all keys in parallel', async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce('"a"')
        .mockResolvedValueOnce(null);
      const results = await service.mget('k1', 'k2');
      expect(results).toEqual(['a', undefined]);
    });

    it('mset stores each entry via set', async () => {
      await service.mset({ x: 10, y: 20 }, 100);
      expect(mockRedisInstance.set).toHaveBeenCalledTimes(2);
    });

    it('mdel deletes each key', async () => {
      await service.mdel('a', 'b');
      expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    });

    it('keys returns result from redis.keys', async () => {
      mockRedisInstance.keys.mockResolvedValueOnce(['a', 'b']);
      expect(await service.keys()).toEqual(['a', 'b']);
    });

    it('acquires a distributed lock with NX and PX', async () => {
      mockRedisInstance.set.mockResolvedValueOnce('OK');

      await expect(
        service.acquireLock('lock:key', 'owner-1', 5000),
      ).resolves.toBe(true);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'lock:key',
        'owner-1',
        'PX',
        5000,
        'NX',
      );
    });

    it('releases a distributed lock only through compare-and-delete', async () => {
      await expect(service.releaseLock('lock:key', 'owner-1')).resolves.toBe(
        true,
      );
      expect(mockRedisInstance.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("GET", KEYS[1]) == ARGV[1]'),
        1,
        'lock:key',
        'owner-1',
      );
    });

    it('does not release a distributed lock owned by another execution', async () => {
      mockRedisInstance.eval.mockResolvedValueOnce(0);

      await expect(
        service.releaseLock('lock:key', 'other-owner'),
      ).resolves.toBe(false);
    });
  });

  describe('in-memory lock fallback', () => {
    beforeEach(() => {
      config = { get: jest.fn().mockReturnValue(undefined) };
      service = new CacheService(config as ConfigService);
    });

    it('does not acquire or release a lock owned by another execution', async () => {
      await expect(
        service.acquireLock('lock:key', 'owner-1', 5000),
      ).resolves.toBe(true);
      await expect(
        service.acquireLock('lock:key', 'owner-2', 5000),
      ).resolves.toBe(false);
      await expect(service.releaseLock('lock:key', 'owner-2')).resolves.toBe(
        false,
      );
      await expect(service.releaseLock('lock:key', 'owner-1')).resolves.toBe(
        true,
      );
    });

    it('allows acquiring the lock after its TTL expires', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      await service.acquireLock('lock:key', 'owner-1', 100);

      now.mockReturnValue(1100);

      await expect(
        service.acquireLock('lock:key', 'owner-2', 100),
      ).resolves.toBe(true);
    });
  });

  describe('Redis error fallback during operations', () => {
    it('activates fallback when redis emits error event', async () => {
      let errorHandler: (err: Error) => void;
      mockRedisInstance.on.mockImplementation(
        (_event: string, handler: (err: Error) => void) => {
          errorHandler = handler;
        },
      );

      config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();

      errorHandler!(new Error('ECONNREFUSED'));
      expect(service.isConnected()).toBe(false);
    });

    it('does not activate local fallback after a Redis error in production', async () => {
      let errorHandler: (err: Error) => void;
      mockRedisInstance.on.mockImplementation(
        (_event: string, handler: (err: Error) => void) => {
          errorHandler = handler;
        },
      );
      config = {
        get: jest.fn((key: string) =>
          key === 'NODE_ENV' ? 'production' : 'redis://localhost:6379',
        ),
      };
      service = new CacheService(config as ConfigService);
      await service.onModuleInit();

      errorHandler!(new Error('ECONNREFUSED'));

      await expect(service.get('critical')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
