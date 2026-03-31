import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { TradesService } from '../../application/services/trades.service';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  getTrades(
    @CurrentUser() payload: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.tradesService.listUserTrades(payload.sub, Number(limit ?? 20));
  }
}
