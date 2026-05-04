import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheManagerStore } from 'cache-manager';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy, CacheManagerStore {
  private readonly logger = new Logger(CacheService.name);
  private readonly fallbackStore = new Map<string, string>();
  private redis: Redis | null = null;
  private connected = false;
  private fallbackWarningShown = false;

  readonly name = 'hybrid-redis-cache';
  readonly opts: any = {};

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL');

    if (!url) return;

    try {
      this.redis = new Redis(url, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      this.redis.on('error', (error) => {
        this.activateFallback(`Redis no disponible: ${error.message}`);
      });
      await this.redis.connect();
      await this.redis.ping();
      this.connected = true;
    } catch {
      this.activateFallback('Redis no pudo inicializarse. Se usara cache en memoria.');
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
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (this.connected && this.redis) {
      if (ttl) {
        await this.redis.set(key, stringValue, 'PX', ttl);
      } else {
        await this.redis.set(key, stringValue);
      }
      return;
    }

    this.fallbackStore.set(key, stringValue);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const rawValue =
      this.connected && this.redis
        ? await this.redis.get(key)
        : this.fallbackStore.get(key);

    if (!rawValue) return undefined;

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return rawValue as unknown as T;
    }
  }

  async del(key: string): Promise<void> {
    if (this.connected && this.redis) {
      await this.redis.del(key);
      return;
    }

    this.fallbackStore.delete(key);
  }

  async delete(key: string): Promise<boolean> {
    const exists = await this.get(key);
    await this.del(key);
    return !!exists;
  }

  async reset(): Promise<void> {
    if (this.connected && this.redis) {
      await this.redis.flushall();
      return;
    }

    this.fallbackStore.clear();
  }

  async clear(): Promise<void> { return this.reset(); }

  async ttl(key: string): Promise<number> {
    return this.connected && this.redis ? this.redis.pttl(key) : -1;
  }

  async mget(...keys: string[]): Promise<unknown[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async mset(data: Record<string, any>, ttl?: number): Promise<void> {
    await Promise.all(
      Object.entries(data).map(([key, value]) => this.set(key, value, ttl)),
    );
  }

  async mdel(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.del(key)));
  }

  async keys(): Promise<string[]> {
    if (this.connected && this.redis) return this.redis.keys('*');
    return Array.from(this.fallbackStore.keys());
  }

  isConnected(): boolean {
    return this.connected;
  }

  private activateFallback(message: string): void {
    this.connected = false;

    if (this.redis) {
      this.redis.disconnect(false);
      this.redis = null;
    }

    if (!this.fallbackWarningShown) {
      this.logger.warn(message);
      this.fallbackWarningShown = true;
    }
  }
}
