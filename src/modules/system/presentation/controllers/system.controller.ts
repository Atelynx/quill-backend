import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '../../application/services/health/health.service';

@Controller('system')
export class SystemController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth() {
    return this.getReadiness();
  }

  @Get('health/live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('health/ready')
  getReadiness() {
    const readiness = this.healthService.getReadiness();

    if (!readiness.ready) {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
