import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { CacheService } from './cache.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cacheService: CacheService,
  ) {}

  getStatus() {
    return {
      status: 'ok',
      services: {
        mongodb:
          this.connection.readyState === ConnectionStates.connected
            ? 'up'
            : 'down',
        redis: this.cacheService.isConnected() ? 'up' : 'fallback',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
