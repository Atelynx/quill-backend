import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { ParseLimitPipe } from '../../../../common/pipes/parse-limit.pipe';
import { TradesService } from '../../application/services/trades.service';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  getTrades(
    @CurrentUser() payload: JwtPayload,
    @Query('limit', new ParseLimitPipe(20, 100)) limit: number,
  ) {
    return this.tradesService.listUserTrades(payload.sub, limit);
  }
}
