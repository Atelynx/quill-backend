import { Global, Module } from '@nestjs/common';
import { CacheService } from './application/services/cache.service';
import { HealthService } from './application/services/health.service';
import { SystemController } from './presentation/controllers/system.controller';

@Global()
@Module({
  controllers: [SystemController],
  providers: [CacheService, HealthService],
  exports: [CacheService, HealthService],
})
export class SystemModule {}
