import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness() {
    const mongodbUp = this.connection.readyState === ConnectionStates.connected;
    const redisUp = this.cacheService.isConnected();
    const redisRequired =
      this.configService.get<string>('NODE_ENV', 'development') ===
      'production';
    const ready = mongodbUp && (redisUp || !redisRequired);
    const redisStatus = redisUp
      ? 'up'
      : redisRequired
        ? 'unavailable'
        : 'fallback';

    return {
      status: ready ? (redisUp ? 'ok' : 'degraded') : 'error',
      ready,
      services: {
        mongodb: mongodbUp ? 'up' : 'down',
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return this.getReadiness();
  }
}
