import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { PortfolioService } from '../../application/services/portfolio.service';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('summary')
  getSummary(@CurrentUser() payload: JwtPayload) {
    return this.portfolioService.getSummary(payload.sub);
  }
}
