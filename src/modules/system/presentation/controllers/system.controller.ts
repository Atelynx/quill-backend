import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../../application/services/health.service';

@Controller('system')
export class SystemController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth() {
    return this.healthService.getStatus();
  }
}
