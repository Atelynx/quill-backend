import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './application/services/cache/cache.service';
import { HealthService } from './application/services/health/health.service';
import { SystemController } from './presentation/controllers/system.controller';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [CacheService],
      useFactory: (cacheService: CacheService) => ({
        stores: [cacheService],
      }),
    }),
  ],
  controllers: [SystemController],
  providers: [CacheService, HealthService],
  exports: [CacheModule, CacheService, HealthService],
})
export class SystemModule {}
