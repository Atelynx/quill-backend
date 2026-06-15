import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cacheService: CacheService,
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

    return {
      status: mongodbUp ? (redisUp ? 'ok' : 'degraded') : 'error',
      ready: mongodbUp,
      services: {
        mongodb: mongodbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'fallback',
      },
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return this.getReadiness();
  }
}
