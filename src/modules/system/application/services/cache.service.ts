import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly fallbackStore = new Map<string, string>();
  private redis: Redis | null = null;
  private connected = false;
  private fallbackWarningShown = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL');

    if (!url) {
      return;
    }

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
      this.activateFallback(
        'Redis no pudo inicializarse. Se usara cache en memoria.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      if (this.redis.status !== 'end') {
        await this.redis.quit();
      }
    } catch {
      this.redis.disconnect(false);
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (this.connected && this.redis) {
      await this.redis.set(key, value);
      return;
    }

    this.fallbackStore.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    if (this.connected && this.redis) {
      return this.redis.get(key);
    }

    return this.fallbackStore.get(key) ?? null;
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
