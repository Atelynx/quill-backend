import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheManagerStore } from 'cache-manager';
import Redis from 'ioredis';
import {
  BoundedMemoryCache,
  deserializeCacheValue,
  serializeCacheValue,
} from './bounded-memory-cache';
import { CacheFallbackPolicy } from './cache-fallback-policy';
import { createRedisClient } from './create-redis-client';

@Injectable()
export class CacheService
  implements OnModuleInit, OnModuleDestroy, CacheManagerStore
{
  private readonly logger = new Logger(CacheService.name);
  private readonly fallbackStore = new BoundedMemoryCache(1000);
  private redis: Redis | null = null;
  private connected = false;
  private fallbackWarningShown = false;
  private readonly fallbackPolicy: CacheFallbackPolicy;
  readonly name = 'hybrid-redis-cache';
  readonly opts: Record<string, unknown> = {};
  constructor(private readonly configService: ConfigService) {
    this.fallbackPolicy = new CacheFallbackPolicy(configService);
  }

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url) {
      this.handleRedisUnavailable('Redis no está configurado.');
      return;
    }
    try {
      this.redis = createRedisClient(url, (error) => {
        this.handleRedisUnavailable(`Redis no disponible: ${error.message}`);
      });
      await this.redis.connect();
      await this.redis.ping();
      this.connected = true;
    } catch {
      this.handleRedisUnavailable('Redis no pudo inicializarse.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) return;
    try {
      if (this.redis.status !== 'end') await this.redis.quit();
    } catch {
      this.redis.disconnect(false);
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const stringValue = serializeCacheValue(value);
    if (this.connected && this.redis) {
      if (ttl) {
        await this.redis.set(key, stringValue, 'PX', ttl);
      } else {
        await this.redis.set(key, stringValue);
      }
      return;
    }
    this.fallbackPolicy.assertAllowed();
    this.fallbackStore.set(key, stringValue, ttl);
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.connected || !this.redis) {
      this.fallbackPolicy.assertAllowed();
      return deserializeCacheValue<T>(this.fallbackStore.get(key));
    }
    const rawValue = await this.redis.get(key);
    return deserializeCacheValue<T>(rawValue);
  }

  async del(key: string): Promise<void> {
    if (this.connected && this.redis) {
      await this.redis.del(key);
      return;
    }
    this.fallbackPolicy.assertAllowed();
    this.fallbackStore.delete(key);
  }

  async delete(key: string): Promise<boolean> {
    const exists = await this.get(key);
    await this.del(key);
    return !!exists;
  }

  async reset(): Promise<void> {
    if (this.connected && this.redis) {
      await this.redis.flushdb();
      return;
    }
    this.fallbackPolicy.assertAllowed();
    this.fallbackStore.clear();
  }

  async clear(): Promise<void> {
    return this.reset();
  }
  async ttl(key: string): Promise<number> {
    if (this.connected && this.redis) return this.redis.pttl(key);
    this.fallbackPolicy.assertAllowed();
    return this.fallbackStore.ttl(key);
  }

  async mget(...keys: string[]): Promise<unknown[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }
  async mset(data: Record<string, unknown>, ttl?: number): Promise<void> {
    await Promise.all(
      Object.entries(data).map(([key, value]) => this.set(key, value, ttl)),
    );
  }

  async mdel(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.del(key)));
  }

  async keys(): Promise<string[]> {
    if (this.connected && this.redis) return this.redis.keys('*');
    this.fallbackPolicy.assertAllowed();
    return Array.from(this.fallbackStore.keys());
  }

  isConnected(): boolean {
    return this.connected;
  }
  private handleRedisUnavailable(message: string): void {
    this.connected = false;
    if (this.redis) {
      this.redis.disconnect(false);
      this.redis = null;
    }
    if (!this.fallbackWarningShown) {
      this.fallbackPolicy.logUnavailable(this.logger, message);
      this.fallbackWarningShown = true;
    }
  }
}
